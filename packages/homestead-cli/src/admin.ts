/**
 * `homestead admin reset-password` — rotate the superuser password. The db
 * write runs as a runtime child of the project's homestead-server
 * (tools/reset-password.ts) so the binary never bundles engine code: the
 * hashing logic always matches the server version that owns the db.
 */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { loadProject } from './project.ts';
import { findRuntime, resolveServerModule } from './runtime.ts';

export interface ResetPasswordOptions {
  dataDir?: string;
  email?: string;
}

export async function resetPasswordCmd(opts: ResetPasswordOptions): Promise<number> {
  const dataDir = opts.dataDir ? resolve(opts.dataDir) : loadProject('.').dataDir;
  const tool = resolveServerModule('.', 'tools', 'reset-password.ts');
  const cmd = findRuntime('.').run(tool, [
    '--data-dir',
    dataDir,
    ...(opts.email ? ['--email', opts.email] : []),
  ]);
  const proc = spawn(cmd[0]!, cmd.slice(1), { stdio: 'inherit' });
  return new Promise<number>((resolveExit) => {
    proc.once('error', () => resolveExit(1));
    proc.once('exit', (code, signal) => resolveExit(code ?? (signal ? 1 : 0)));
  });
}
