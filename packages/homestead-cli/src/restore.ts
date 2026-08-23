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

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
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

export interface RestoreOptions {
  from?: string;
  dataDir?: string;
  verify?: boolean;
  force?: boolean;
  allowKeyMismatch?: boolean;
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

export function restoreCmd(
  opts: RestoreOptions,
  verifyDbs: DatabaseVerifier = verifyDatabasesViaServer,
): number {
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
    const extract = spawnSync('tar', ['-xzf', archive, '-C', staging], { stdio: 'inherit' });
    if (extract.error || extract.status !== 0) {
      console.error(
        `could not extract ${archive}: ${
          extract.error ? extract.error.message : `tar exit ${extract.status}`
        }`,
      );
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
