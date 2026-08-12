/**
 * `homestead restore <archive>` — restore a backup written by `homestead
 * backup` into the data directory, then verify each database's integrity.
 *
 * Refuses to overwrite a populated data dir unless --force. Stop the server
 * first — restoring under a live server is unsupported. The work runs as a
 * child of the project's homestead-server (tools/restore.ts) so the binary
 * never bundles engine/SQLite code.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadProject } from './project.ts';
import { findRuntime, resolveServerModule } from './runtime.ts';

export async function restoreCmd(opts: {
  archive?: string;
  dataDir?: string;
  force?: boolean;
}): Promise<number> {
  if (!opts.archive) {
    console.error('usage: homestead restore <archive> [--data-dir=PATH] [--force]');
    return 1;
  }
  const archive = resolve(opts.archive);
  if (!existsSync(archive)) {
    console.error(`no archive at ${archive}`);
    return 1;
  }

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

  const tool = resolveServerModule('.', 'tools', 'restore.ts');
  const args = ['--data-dir', dataDir, '--archive', archive, ...(opts.force ? ['--force'] : [])];
  const cmd = findRuntime('.').run(tool, args);
  const proc = spawn(cmd[0]!, cmd.slice(1), { stdio: 'inherit' });
  return new Promise<number>((resolveExit) => {
    proc.once('error', () => resolveExit(1));
    proc.once('exit', (code, signal) => resolveExit(code ?? (signal ? 1 : 0)));
  });
}
