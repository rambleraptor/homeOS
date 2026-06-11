/**
 * `homestead admin reset-password` — rotate the superuser password. The db
 * write runs as a bun child of the project's homestead-server
 * (tools/reset-password.ts) so the binary never bundles engine code: the
 * hashing logic always matches the server version that owns the db.
 */

import { resolve } from 'node:path';
import { loadProject } from './project.ts';
import { findBun, resolveServerModule } from './runtime.ts';

export interface ResetPasswordOptions {
  dataDir?: string;
  email?: string;
}

export async function resetPasswordCmd(opts: ResetPasswordOptions): Promise<number> {
  const dataDir = opts.dataDir ? resolve(opts.dataDir) : loadProject('.').dataDir;
  const tool = resolveServerModule('.', 'tools', 'reset-password.ts');
  const proc = Bun.spawn({
    cmd: [
      findBun(),
      'run',
      tool,
      '--data-dir',
      dataDir,
      ...(opts.email ? ['--email', opts.email] : []),
    ],
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });
  return proc.exited;
}
