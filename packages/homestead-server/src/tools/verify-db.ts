/**
 * `bun tools/verify-db.ts --dir <dir>`
 *
 * Integrity-checks every SQLite database in `--dir`. Used by
 * `homestead restore` on an extracted archive, so a corrupt database is caught
 * before it replaces a working data dir rather than after.
 *
 * Runs as a runtime child of the project's homestead-server for the same
 * reason as `tools/snapshot.ts`: the SQLite driver comes from the version that
 * owns the db, never from the launcher binary.
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { checkDatabase, findDatabases } from '../snapshot';
import { flagValue } from './flags';

const dirArg = flagValue(process.argv.slice(2), '--dir');
if (!dirArg) {
  console.error('usage: verify-db.ts --dir <dir>');
  process.exit(1);
}

const dir = resolve(dirArg);
if (!existsSync(dir)) {
  console.error(`no directory at ${dir}`);
  process.exit(1);
}

const names = findDatabases(dir);
try {
  for (const name of names) {
    checkDatabase(join(dir, name));
    console.error(`  ok ${name}`);
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
process.stdout.write(`${JSON.stringify({ databases: names })}\n`);
