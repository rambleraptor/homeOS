/**
 * `homestead backup` — archive the data directory (sqlite databases + files).
 *
 * Two things this command has to get right:
 *
 * 1. **A consistent database.** The databases run in WAL mode, so tarring the
 *    live `<name>.db` + `-wal` + `-shm` while the server writes can capture an
 *    inconsistent set. Instead each database is snapshotted with `VACUUM INTO`
 *    (a runtime child of the project's homestead-server, see
 *    `homestead-server/src/snapshot.ts`) and the snapshot is what gets
 *    archived; the live db files are excluded.
 *
 * 2. **An honest description of what it produced.** Encryption at rest is
 *    opt-in and covers only file bytes and extracted-text columns, so the
 *    archive is either fully plaintext (no master key) or partly plaintext
 *    (structured fields, the search index, account rows). The summary says
 *    which, rather than claiming the archive is safe to store anywhere.
 *
 * The master key itself must never ride along: the command refuses to run if
 * the key file lives inside the data dir.
 */

import { spawn, spawnSync } from 'node:child_process';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { pipeline } from 'node:stream/promises';
import { basename, join, resolve, sep } from 'node:path';
import { loadProject } from './project.ts';
import { keyFingerprint, resolveKeyLocation, type KeyLocation } from './key.ts';
import { findRuntime, resolveServerModule } from './runtime.ts';
import {
  hashEntries,
  MANIFEST_FORMAT,
  MANIFEST_NAME,
  writeManifest,
  type BackupManifest,
} from './manifest.ts';
import { HOMESTEAD_VERSION } from './version.ts';
import {
  ARCHIVE_FORMAT_VERSION,
  EncryptBody,
  recipientFingerprint,
  sealHeader,
} from './archive-crypto.ts';
import { resolveRecipient } from './backup-key.ts';

/** True if `child` is the same path as, or nested inside, `parent`. */
export function isInside(parent: string, child: string): boolean {
  const p = resolve(parent);
  const c = resolve(child);
  return c === p || c.startsWith(p + sep);
}

/** SQLite sidecars that must not be archived alongside a `VACUUM INTO` copy. */
const DB_SIDECAR_SUFFIXES = ['-wal', '-shm', '-journal'];

/**
 * Split a data dir's top-level entries into the live database artifacts (which
 * the snapshot replaces) and everything else (`files/`, and anything an
 * operator or a future release puts there), which is archived as-is.
 *
 * Passing an explicit operand list to tar rather than `--exclude` patterns
 * keeps the behavior identical on GNU tar and bsdtar.
 */
export function partitionDataDir(entries: string[]): { dbArtifacts: string[]; others: string[] } {
  const dbArtifacts: string[] = [];
  const others: string[] = [];
  for (const name of entries) {
    const isDb =
      name.endsWith('.db') ||
      DB_SIDECAR_SUFFIXES.some((suffix) => name.endsWith(`.db${suffix}`));
    (isDb ? dbArtifacts : others).push(name);
  }
  return { dbArtifacts, others };
}

/** How much of the archive the master key actually protects. */
export type EncryptionState = 'on' | 'off';

export function encryptionState(key: KeyLocation): EncryptionState {
  return key.source !== 'none' && key.value ? 'on' : 'off';
}

function humanBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${i === 0 ? n : n.toFixed(1)} ${units[i]}`;
}

/**
 * The post-backup summary. Split out from the command so the wording is
 * testable — getting this wrong is how an operator ends up treating a
 * plaintext copy of their household as safe to hand around.
 *
 * Two independent things decide the wording: whether the archive as a whole is
 * encrypted to a backup key, and whether encryption at rest was on for the
 * data that went into it.
 */
export function summaryLines(args: {
  state: EncryptionState;
  key: KeyLocation;
  recipient?: string;
}): string[] {
  const { state, key, recipient } = args;
  if (recipient) {
    const lines = [
      `  This archive is encrypted to backup key ${recipientFingerprint(recipient)}.`,
      '  It is ciphertext end to end — safe to store anywhere, including a disk or',
      '  a bucket you do not control. This machine cannot read it back; only the',
      '  matching backup identity can.',
      '',
    ];
    if (state === 'on') {
      lines.push(
        '  Restoring it needs BOTH secrets:',
        '    the backup identity — opens the archive',
        '    the master key      — reads the encrypted files inside it',
        '  Keep them somewhere separate from the archive, and from each other.',
      );
    } else {
      lines.push(
        '  Encryption at rest is off, so once the archive is opened its contents are',
        '  plaintext: the backup identity is the only thing protecting them. Keep it',
        '  somewhere separate from the archive.',
      );
    }
    return lines;
  }

  if (state === 'off') {
    return [
      '  ⚠  This archive is PLAINTEXT — nothing about it is encrypted.',
      '     It holds your whole household database and every uploaded file.',
      "     Store it the way you'd store the data directory itself: somewhere",
      '     private, not a shared drive or a bucket you treat as public.',
      '',
      '     `homestead backup-key generate` encrypts future archives outright,',
      '     so they are safe to store anywhere.',
    ];
  }
  const keyHint =
    key.source === 'env'
      ? "it lives only in this instance's environment (HOMESTEAD_MASTER_KEY)"
      : `it lives at ${key.path}`;
  return [
    '  Encryption at rest is ON, so in this archive:',
    '    encrypted  uploaded file bytes, extracted-text columns',
    '    PLAINTEXT  structured fields (names, amounts, card numbers), the',
    '               search index (vectors.db), and account rows (password',
    '               hashes, tokens)',
    '',
    '  Treat it as sensitive — it is not safe to store just anywhere.',
    '  `homestead backup-key generate` encrypts the whole archive, which is.',
    '',
    `  Your master key is NOT in the archive — ${keyHint}.`,
    '  Keep a copy somewhere separate (`homestead key show` prints it);',
    '  without it the encrypted files cannot be restored.',
  ];
}

export interface BackupOptions {
  dataDir?: string;
  out?: string;
  stamp?: string;
  /** Backup key to encrypt the archive to; overrides the configured one. */
  recipient?: string;
  recipientFile?: string;
  /** Archive creation time; injectable so tests get a stable manifest. */
  now?: Date;
}

/**
 * Describe the archive being written: what produced it, what is in it, and
 * which master key its encrypted bytes belong to.
 */
export function buildManifest(args: {
  dataDirName: string;
  key: KeyLocation;
  databases: string[];
  files: BackupManifest['files'];
  now: Date;
}): BackupManifest {
  const enabled = encryptionState(args.key) === 'on';
  return {
    format: MANIFEST_FORMAT,
    created_at: args.now.toISOString(),
    homestead_version: HOMESTEAD_VERSION,
    data_dir_name: args.dataDirName,
    encryption: enabled
      ? { enabled: true, key_id: keyFingerprint(args.key.value!) }
      : { enabled: false },
    databases: args.databases,
    // One globally sorted list, so a manifest reads (and diffs) predictably
    // regardless of which group a file came from.
    files: [...args.files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
  };
}

/**
 * Captures the data dir's databases into `outDir`, returning the snapshot
 * filenames (or null when it failed, having already reported why). Injectable
 * so the command's archive assembly can be tested without a live server —
 * `homestead-server/test/snapshot.test.ts` covers the real VACUUM INTO.
 */
export type Snapshotter = (dataDir: string, outDir: string) => string[] | null;

export async function backupCmd(
  opts: BackupOptions,
  snapshot: Snapshotter = snapshotViaServer,
): Promise<number> {
  let dataDir: string;
  if (opts.dataDir) {
    dataDir = resolve(opts.dataDir);
  } else {
    try {
      dataDir = loadProject('.').dataDir;
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      return 1;
    }
  }

  if (!existsSync(dataDir)) {
    console.error(`no data directory at ${dataDir} — nothing to back up`);
    return 1;
  }

  // Guard: the master key must never ride along in the archive.
  const key = resolveKeyLocation();
  if (key.path && isInside(dataDir, key.path)) {
    console.error(
      `master key ${key.path} is inside the data dir ${dataDir}.\n` +
        'Backing that up would defeat encryption-at-rest. Move the key outside the\n' +
        'data dir (e.g. `homestead key generate` writes to ~/.homestead) and retry.',
    );
    return 1;
  }

  // A configured backup key turns archive encryption on by itself, the way a
  // master key turns encryption at rest on — one less flag to remember on the
  // command an operator runs least often.
  const recipientLoc = resolveRecipient(opts);
  if (recipientLoc.source !== 'none' && !recipientLoc.value) {
    console.error(`no backup recipient at ${recipientLoc.path} — nothing to encrypt to`);
    return 1;
  }
  const recipient = recipientLoc.value;
  if (recipient) {
    try {
      recipientFingerprint(recipient);
    } catch (err) {
      console.error(
        `${recipientLoc.path ?? 'the configured backup recipient'} is not usable: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
      return 1;
    }
  }

  const suffix = recipient ? '.tar.gz.enc' : '.tar.gz';
  const out = resolve(opts.out ?? `homestead-backup-${opts.stamp ?? 'latest'}${suffix}`);
  const now = opts.now ?? new Date();
  const staging = mkdtempSync(join(tmpdir(), 'homestead-backup-'));
  try {
    const snapshotDir = join(staging, 'db');
    mkdirSync(snapshotDir, { recursive: true });
    const databases = snapshot(dataDir, snapshotDir);
    if (databases === null) return 1;

    const { others } = partitionDataDir(readdirSync(dataDir));
    if (databases.length === 0 && others.length === 0) {
      console.error(`${dataDir} is empty — nothing to back up`);
      return 1;
    }
    if (others.includes(MANIFEST_NAME)) {
      // Both would land at the archive root under the same name, and the data
      // dir's copy — extracted last — would shadow the real manifest.
      console.error(
        `${join(dataDir, MANIFEST_NAME)} collides with the archive's own manifest.\n` +
          'Rename or move that file, then retry.',
      );
      return 1;
    }

    writeManifest(
      join(staging, MANIFEST_NAME),
      buildManifest({
        dataDirName: basename(dataDir),
        key,
        databases,
        files: [...hashEntries(snapshotDir, databases), ...hashEntries(dataDir, others)],
        now,
      }),
    );

    // Three -C groups: the manifest, the snapshotted databases, then the rest
    // of the data dir. All land at the archive root, so extracting the archive
    // (minus the manifest) reproduces a data dir.
    const groups = ['-C', staging, MANIFEST_NAME];
    if (databases.length > 0) groups.push('-C', snapshotDir, ...databases);
    if (others.length > 0) groups.push('-C', dataDir, ...others);

    if (recipient) {
      const failure = await writeEncryptedArchive(groups, out, recipient, now);
      if (failure) {
        // Never leave a half-written archive that looks restorable.
        rmSync(out, { force: true });
        console.error(failure);
        return 1;
      }
    } else {
      const result = spawnSync('tar', ['-czf', out, ...groups], { stdio: 'inherit' });
      if (result.error || result.status !== 0) {
        console.error(
          `tar failed: ${result.error ? result.error.message : `exit ${result.status}`}`,
        );
        return 1;
      }
    }
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }

  console.log(`wrote ${out} (${humanBytes(statSync(out).size)})`);
  console.log('');
  for (const line of summaryLines({ state: encryptionState(key), key, recipient })) {
    console.log(line);
  }
  return 0;
}

/**
 * Stream `tar` straight through encryption into the output file.
 *
 * Streaming rather than tar-then-encrypt is the point: a plaintext archive is
 * never written to disk (where it would outlive the command in free space),
 * and an archive far larger than memory still works. Returns an error message,
 * or null on success.
 */
async function writeEncryptedArchive(
  groups: string[],
  out: string,
  recipient: string,
  now: Date,
): Promise<string | null> {
  const { header, dek } = sealHeader(recipient, {
    format: ARCHIVE_FORMAT_VERSION,
    created_at: now.toISOString(),
    homestead_version: HOMESTEAD_VERSION,
    recipient,
  });

  const tar = spawn('tar', ['-czf', '-', ...groups], { stdio: ['ignore', 'pipe', 'inherit'] });
  const exited = new Promise<string | null>((done) => {
    tar.once('error', (err) => done(`could not run tar: ${err.message}`));
    tar.once('exit', (code, signal) =>
      done(code === 0 ? null : `tar failed: ${signal ? `signal ${signal}` : `exit ${code}`}`),
    );
  });

  const sink = createWriteStream(out);
  sink.write(header);
  try {
    await pipeline(tar.stdout!, new EncryptBody(dek), sink);
  } catch (err) {
    // Surface tar's own failure in preference to the broken-pipe it causes.
    return (await exited) ?? `could not write ${out}: ${(err as Error).message}`;
  }
  return exited;
}

/**
 * The real snapshotter: runs `tools/snapshot.ts` as a runtime child of the
 * project's homestead-server, so the SQLite driver always matches the version
 * that owns the db (same rule as `homestead admin reset-password`).
 */
function snapshotViaServer(dataDir: string, outDir: string): string[] | null {
  let tool: string;
  try {
    tool = resolveServerModule('.', 'tools', 'snapshot.ts');
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return null;
  }

  const cmd = findRuntime('.').run(tool, ['--data-dir', dataDir, '--out-dir', outDir]);
  const result = spawnSync(cmd[0]!, cmd.slice(1), {
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf8',
  });
  if (result.error || result.status !== 0) {
    console.error(
      `database snapshot failed: ${
        result.error ? result.error.message : `exit ${result.status}`
      }`,
    );
    return null;
  }

  try {
    const report = JSON.parse(result.stdout.trim()) as { databases: Array<{ name: string }> };
    return report.databases.map((d) => d.name);
  } catch {
    console.error('database snapshot produced no readable report');
    return null;
  }
}
