/**
 * `homestead backup` — write a crash-consistent archive of the data directory
 * (sqlite databases snapshotted with VACUUM INTO, plus the files tree).
 *
 * Under encryption-at-rest the on-disk bytes are already ciphertext, so the
 * archive is safe to store anywhere — as long as the master key is NOT in it.
 * This command refuses to run if the key file lives inside the data dir. The
 * snapshot itself runs as a child of the project's homestead-server
 * (tools/backup.ts) so the binary never bundles engine/SQLite code.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { loadProject } from './project.ts';
import { resolveKeyLocation } from './key.ts';
import { findRuntime, resolveServerModule } from './runtime.ts';

/** True if `child` is the same path as, or nested inside, `parent`. */
function isInside(parent: string, child: string): boolean {
  const p = resolve(parent);
  const c = resolve(child);
  return c === p || c.startsWith(p + sep);
}

function spawnTool(tool: string, args: string[]): Promise<number> {
  const cmd = findRuntime('.').run(tool, args);
  const proc = spawn(cmd[0]!, cmd.slice(1), { stdio: 'inherit' });
  return new Promise<number>((resolveExit) => {
    proc.once('error', () => resolveExit(1));
    proc.once('exit', (code, signal) => resolveExit(code ?? (signal ? 1 : 0)));
  });
}

export async function backupCmd(opts: {
  dataDir?: string;
  out?: string;
  stamp?: string;
}): Promise<number> {
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

  const out = resolve(opts.out ?? `homestead-backup-${opts.stamp ?? 'latest'}.tar.gz`);
  const tool = resolveServerModule('.', 'tools', 'backup.ts');
  return spawnTool(tool, ['--data-dir', dataDir, '--out', out]);
}
