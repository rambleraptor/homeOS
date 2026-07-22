/**
 * `homestead backup` — archive the data directory (sqlite db + files).
 *
 * Under encryption-at-rest the on-disk bytes are already ciphertext, so the
 * archive is safe to store anywhere — as long as the master key is NOT in it.
 * This command refuses to run if the key file lives inside the data dir, and
 * reminds the operator to keep the key separate.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, dirname, resolve, sep } from 'node:path';
import { loadProject } from './project.ts';
import { resolveKeyLocation } from './key.ts';

/** True if `child` is the same path as, or nested inside, `parent`. */
function isInside(parent: string, child: string): boolean {
  const p = resolve(parent);
  const c = resolve(child);
  return c === p || c.startsWith(p + sep);
}

export function backupCmd(opts: { dataDir?: string; out?: string; stamp?: string }): number {
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

  const out = opts.out ?? `homestead-backup-${opts.stamp ?? 'latest'}.tar.gz`;
  const result = spawnSync(
    'tar',
    ['-czf', out, '-C', dirname(dataDir), basename(dataDir)],
    { stdio: 'inherit' },
  );
  if (result.error || result.status !== 0) {
    console.error(`tar failed: ${result.error ? result.error.message : `exit ${result.status}`}`);
    return 1;
  }

  console.log(`wrote ${out}`);
  console.log('');
  console.log('  This archive is ciphertext and safe to store anywhere.');
  console.log('  Your master key is NOT in it — keep that stored separately');
  console.log('  (`homestead key show` prints it). The archive is useless without it.');
  return 0;
}
