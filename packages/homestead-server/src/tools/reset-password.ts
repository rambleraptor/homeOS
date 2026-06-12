/**
 * `bun tools/reset-password.ts --data-dir <dir> [--email <email>]`
 *
 * Rotates the superuser password by writing directly to the sqlite db — the
 * recovery path when the printed-once boot password is lost. Invoked by the
 * launcher (`homestead admin reset-password`) as a bun child so the binary
 * never bundles engine code: the hashing/token logic always comes from the
 * project's homestead-server version, matching the db it touches.
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Database } from '../engine/sqlite';
import { resetSuperuserPassword } from '../bootstrap';

function flagValue(argv: string[], name: string): string | undefined {
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = argv.indexOf(name);
  return i !== -1 ? argv[i + 1] : undefined;
}

const argv = process.argv.slice(2);
const dataDir = flagValue(argv, '--data-dir');
if (!dataDir) {
  console.error('usage: reset-password.ts --data-dir <dir> [--email <email>]');
  process.exit(1);
}

const dbPath = join(resolve(dataDir), 'aepbase.db');
if (!existsSync(dbPath)) {
  console.error(`no database at ${dbPath} — has the server booted at least once?`);
  process.exit(1);
}

const db = new Database(dbPath);
try {
  const { email, password } = await resetSuperuserPassword(db, flagValue(argv, '--email'));
  console.log('superuser password reset:');
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
} finally {
  db.close();
}
