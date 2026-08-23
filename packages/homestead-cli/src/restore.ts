/**
 * `homestead restore` — rebuild a data directory from a `homestead backup`
 * archive, or check that an archive could be restored (`--verify`).
 *
 * An untested backup is not a backup, so this command exists as much for the
 * `--verify` path as for the restore itself: it extracts, checks every file
 * against the manifest's checksums, integrity-checks each database, and
 * confirms the configured master key is the one the archive's encrypted bytes
 * were written under — all without touching the live data dir.
 *
 * The restore itself never destroys the existing data dir: it is renamed aside
 * to `<data-dir>.pre-restore-<stamp>` so a restore that turns out to be the
 * wrong archive is reversible.
 */

import { spawn, spawnSync } from 'node:child_process';
import {
  closeSync,
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readSync,
  renameSync,
  rmSync,
  unlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { pipeline } from 'node:stream/promises';
import { dirname, join, resolve } from 'node:path';
import { loadProject } from './project.ts';
import { keyFingerprint, resolveKeyLocation, type KeyLocation } from './key.ts';
import { findRuntime, resolveServerModule } from './runtime.ts';
import {
  MANIFEST_NAME,
  readManifest,
  verifyExtracted,
  type BackupManifest,
} from './manifest.ts';
import {
  ArchiveDecryptError,
  DecryptBody,
  hasArchiveMagic,
  openHeader,
  readHeader,
  recipientFingerprint,
  recipientForIdentity,
  type ArchiveMeta,
} from './archive-crypto.ts';
import { defaultIdentityPath, resolveIdentity } from './backup-key.ts';

export interface RestoreOptions {
  from?: string;
  dataDir?: string;
  verify?: boolean;
  force?: boolean;
  allowKeyMismatch?: boolean;
  /** Backup identity for an encrypted archive: the key itself, or a path. */
  identity?: string;
  stamp?: string;
}

/** Whether the configured key can decrypt what this archive holds. */
export type KeyVerdict =
  | { ok: true; note?: string }
  | { ok: false; reason: string };

export function checkKey(manifest: BackupManifest, key: KeyLocation): KeyVerdict {
  if (!manifest.encryption.enabled) {
    return {
      ok: true,
      note: 'the archive was written with encryption at rest OFF — its contents are plaintext',
    };
  }
  const configured = key.source !== 'none' && key.value ? keyFingerprint(key.value) : null;
  if (!configured) {
    return {
      ok: false,
      reason:
        'this archive holds encrypted file bytes, but no master key is configured here.\n' +
        'Restore the key first (HOMESTEAD_MASTER_KEY, HOMESTEAD_MASTER_KEY_FILE, or\n' +
        '~/.homestead/master.key) — without it those files cannot be read.',
    };
  }
  if (manifest.encryption.key_id && configured !== manifest.encryption.key_id) {
    return {
      ok: false,
      reason:
        `this archive was written under master key ${manifest.encryption.key_id}, but the ` +
        `configured key is ${configured}.\n` +
        'Restoring under the wrong key leaves every encrypted file unreadable. Point at the\n' +
        'original key, or pass --allow-key-mismatch if you know the difference is expected.',
    };
  }
  return { ok: true };
}

/**
 * Integrity-checks the databases in an extracted archive, reporting problems
 * itself and returning false on failure. Injectable for the same reason as
 * `backup.ts`'s Snapshotter: the archive-handling logic is testable without a
 * live server, while the real check runs through the project's engine.
 */
export type DatabaseVerifier = (dir: string) => boolean;

export async function restoreCmd(
  opts: RestoreOptions,
  verifyDbs: DatabaseVerifier = verifyDatabasesViaServer,
): Promise<number> {
  if (!opts.from) {
    console.error('usage: homestead restore --from=ARCHIVE [--data-dir=PATH] [--verify]');
    return 1;
  }
  const archive = resolve(opts.from);
  if (!existsSync(archive)) {
    console.error(`no archive at ${archive}`);
    return 1;
  }

  // --verify never touches a data dir, so it works outside a project too.
  let dataDir: string | undefined;
  if (opts.dataDir) {
    dataDir = resolve(opts.dataDir);
  } else {
    try {
      dataDir = loadProject('.').dataDir;
    } catch (err) {
      if (!opts.verify) {
        console.error(err instanceof Error ? err.message : String(err));
        return 1;
      }
    }
  }

  // Stage beside the target so the final swap is a same-filesystem rename:
  // atomic, and it can't half-copy a large files/ tree into place.
  const stagingParent = dataDir ? dirname(dataDir) : tmpdir();
  mkdirSync(stagingParent, { recursive: true });
  const staging = mkdtempSync(join(stagingParent, '.homestead-restore-'));
  try {
    const opened = openEncryption(archive, opts);
    if ('error' in opened) {
      console.error(opened.error);
      return 1;
    }
    const extractError = await extractArchive(archive, staging, opened);
    if (extractError) {
      console.error(extractError);
      return 1;
    }

    const manifestPath = join(staging, MANIFEST_NAME);
    if (!existsSync(manifestPath)) {
      console.error(
        `${archive} has no ${MANIFEST_NAME} — it was not written by \`homestead backup\`,\n` +
          'or it predates backup manifests. Extract it by hand with tar if you trust it.',
      );
      return 1;
    }
    const manifest = readManifest(manifestPath);
    if ('error' in manifest) {
      console.error(manifest.error);
      return 1;
    }

    console.log(`archive written ${manifest.created_at} by homestead ${manifest.homestead_version}`);

    const { problems, extra } = verifyExtracted(staging, manifest);
    if (problems.length > 0) {
      console.error(`${archive} does not match its manifest:`);
      for (const problem of problems) console.error(`  ${problem}`);
      console.error(
        '\nThe archive is damaged, or a file changed while the backup ran. Nothing was\n' +
          'restored. Use a different archive, or extract this one by hand with tar to\n' +
          'salvage what is readable.',
      );
      return 1;
    }
    console.log(`  ${manifest.files.length} files match their checksums`);
    for (const path of extra) console.log(`  note: ${path} is in the archive but not the manifest`);

    if (!verifyDbs(staging)) return 1;
    console.log(`  ${manifest.databases.length} databases pass their integrity check`);

    const key = resolveKeyLocation();
    const verdict = checkKey(manifest, key);
    if (!verdict.ok) {
      if (!opts.allowKeyMismatch) {
        console.error(`\n${verdict.reason}`);
        return 1;
      }
      console.log('  note: continuing past the master-key check (--allow-key-mismatch)');
    } else if (verdict.note) {
      console.log(`  note: ${verdict.note}`);
    } else {
      console.log('  master key matches the one this archive was written under');
    }

    if (opts.verify) {
      console.log(`\n${archive} is intact and restorable.`);
      return 0;
    }
    // dataDir is always set here: the lookup above only tolerates a missing
    // project under --verify.
    const target = dataDir!;

    // The manifest is metadata about the archive, not instance data.
    unlinkSync(manifestPath);

    let movedAside: string | undefined;
    if (existsSync(target) && readdirSync(target).length > 0) {
      if (!opts.force) {
        console.error(
          `\n${target} already holds data. Stop the server and re-run with --force to\n` +
            'replace it (the existing directory is renamed aside, not deleted).',
        );
        return 1;
      }
      movedAside = `${target}.pre-restore-${opts.stamp ?? 'previous'}`;
      if (existsSync(movedAside)) {
        console.error(`${movedAside} already exists — move it away first`);
        return 1;
      }
      renameSync(target, movedAside);
    } else if (existsSync(target)) {
      rmSync(target, { recursive: true, force: true });
    }

    renameSync(staging, target);
    console.log(`\nrestored ${manifest.data_dir_name} → ${target}`);
    if (movedAside) console.log(`  previous data dir kept at ${movedAside}`);
    console.log('  Start the server to pick it up (the schema sync runs on boot).');
    return 0;
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

/**
 * Largest header the format can express: the metadata length is a uint16, so
 * reading this much always captures a complete header, however verbose its
 * metadata. Sized from the format rather than guessed, so a large-but-valid
 * header can never be misreported as truncated.
 */
const MAX_HEADER_LEN = 8 + 1 + 2 + 0xffff + 32 + 12 + 32 + 16;

/** Read the first `n` bytes of a file, for sniffing the archive header. */
function readPrefix(path: string, n: number): Buffer {
  const fd = openSync(path, 'r');
  try {
    const buf = Buffer.alloc(n);
    return buf.subarray(0, readSync(fd, buf, 0, n, 0));
  } finally {
    closeSync(fd);
  }
}

type OpenedArchive =
  | { encrypted: false }
  | { encrypted: true; meta: ArchiveMeta; dek: Buffer; headerLen: number };

/**
 * Work out whether the archive is encrypted and, if so, recover its data key.
 *
 * Detection is by magic rather than filename, so a renamed archive still
 * restores. Every failure here is one an operator meets at the worst possible
 * moment, so each names the key the archive wants and where to put it.
 */
export function openEncryption(
  archive: string,
  opts: RestoreOptions,
): OpenedArchive | { error: string } {
  const prefix = readPrefix(archive, MAX_HEADER_LEN);
  if (!hasArchiveMagic(prefix)) return { encrypted: false };

  let meta: ArchiveMeta;
  try {
    meta = readHeader(prefix).meta;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
  const wants = recipientFingerprint(meta.recipient);

  const identity = resolveIdentity(opts);
  if (!identity.value) {
    const where = identity.path ? `\nNo identity found at ${identity.path}.` : '';
    return {
      error:
        `this archive is encrypted to backup key ${wants}, and opening it needs the\n` +
        `matching backup identity — normally kept off this machine.${where}\n\n` +
        'Supply it with --identity=<key-or-path>, or HOMESTEAD_BACKUP_IDENTITY, or put\n' +
        `it at ${defaultIdentityPath()}.`,
    };
  }

  let has: string;
  try {
    has = recipientForIdentity(identity.value);
  } catch (err) {
    return {
      error: `the backup identity is not usable: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
  if (has !== meta.recipient) {
    return {
      error:
        `this archive is encrypted to backup key ${wants}, but the identity supplied is\n` +
        `for backup key ${recipientFingerprint(has)}. Find the identity that was printed\n` +
        "when this archive's recipient was generated.",
    };
  }

  try {
    const { dek, headerLen } = openHeader(prefix, identity.value);
    return { encrypted: true, meta, dek, headerLen };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Extract into `staging`, decrypting on the way when the archive is encrypted.
 * Returns an error message, or null on success. Nothing is decrypted to disk
 * first — the plaintext exists only in the pipe to tar.
 */
async function extractArchive(
  archive: string,
  staging: string,
  opened: OpenedArchive,
): Promise<string | null> {
  if (!opened.encrypted) {
    const extract = spawnSync('tar', ['-xzf', archive, '-C', staging], { stdio: 'inherit' });
    if (extract.error || extract.status !== 0) {
      return `could not extract ${archive}: ${
        extract.error ? extract.error.message : `tar exit ${extract.status}`
      }`;
    }
    return null;
  }

  console.log(`archive is encrypted to backup key ${recipientFingerprint(opened.meta.recipient)}`);
  // tar's stderr is buffered rather than inherited: when decryption fails
  // mid-stream, tar sees a severed pipe and complains loudly about a corrupt
  // gzip. That noise would bury the message that actually tells the operator
  // what went wrong, so it is only surfaced when tar itself is the problem.
  const tar = spawn('tar', ['-xzf', '-', '-C', staging], { stdio: ['pipe', 'inherit', 'pipe'] });
  let tarErr = '';
  tar.stderr!.on('data', (chunk: Buffer) => {
    tarErr += chunk.toString();
  });
  const exited = new Promise<string | null>((done) => {
    tar.once('error', (err) => done(`could not run tar: ${err.message}`));
    tar.once('exit', (code, signal) =>
      done(
        code === 0
          ? null
          : `tar failed: ${signal ? `signal ${signal}` : `exit ${code}`}${
              tarErr.trim() ? `\n${tarErr.trim()}` : ''
            }`,
      ),
    );
  });

  try {
    await pipeline(
      createReadStream(archive, { start: opened.headerLen }),
      new DecryptBody(opened.dek),
      tar.stdin!,
    );
  } catch (err) {
    if (err instanceof ArchiveDecryptError) {
      tar.kill();
      await exited;
      return `${archive} could not be decrypted: ${err.message}`;
    }
    return (await exited) ?? `could not extract ${archive}: ${(err as Error).message}`;
  }
  return exited;
}

/**
 * Integrity-check the extracted databases through the project's
 * homestead-server, so a corrupt archive is caught before it replaces a
 * working data dir.
 */
function verifyDatabasesViaServer(dir: string): boolean {
  let tool: string;
  try {
    tool = resolveServerModule('.', 'tools', 'verify-db.ts');
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return false;
  }
  const cmd = findRuntime('.').run(tool, ['--dir', dir]);
  const result = spawnSync(cmd[0]!, cmd.slice(1), {
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf8',
  });
  if (result.error || result.status !== 0) {
    console.error(
      `database integrity check failed: ${
        result.error ? result.error.message : `exit ${result.status}`
      }`,
    );
    return false;
  }
  return true;
}
