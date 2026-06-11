/**
 * `homestead admin reset-password` — rotate the superuser password by
 * writing directly to the sqlite db. This replaces the old plaintext
 * data/credentials.json: the password is printed once at first boot, and
 * this command is the recovery path.
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Database } from 'bun:sqlite';
import { resetSuperuserPassword } from '@rambleraptor/homestead-server/src/bootstrap.ts';
import { loadProject } from './project.ts';

export interface ResetPasswordOptions {
  dataDir?: string;
  email?: string;
}

export async function resetPasswordCmd(opts: ResetPasswordOptions): Promise<number> {
  const dataDir = opts.dataDir ? resolve(opts.dataDir) : loadProject('.').dataDir;
  const dbPath = join(dataDir, 'aepbase.db');
  if (!existsSync(dbPath)) {
    console.error(`no database at ${dbPath} — has the server booted at least once?`);
    return 1;
  }

  const db = new Database(dbPath);
  try {
    const { email, password } = await resetSuperuserPassword(db, opts.email);
    console.log(`superuser password reset:`);
    console.log(`  Email:    ${email}`);
    console.log(`  Password: ${password}`);
    return 0;
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  } finally {
    db.close();
  }
}
