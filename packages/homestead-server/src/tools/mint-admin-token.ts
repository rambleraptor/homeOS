/**
 * `bun tools/mint-admin-token.ts --data-dir <dir>`
 *
 * Mints a short-lived superuser token directly in the project's sqlite db and
 * prints it as a marker-prefixed JSON line (`@@HOMESTEAD_TOKEN@@{...}` — the
 * launcher's resources command parses this). Invoked as a bun child so the
 * binary never bundles engine code — token minting always matches the
 * project's homestead-server version.
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Database } from '../engine/sqlite';
import { mintAdminToken } from '../bootstrap';

function flagValue(argv: string[], name: string): string | undefined {
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = argv.indexOf(name);
  return i !== -1 ? argv[i + 1] : undefined;
}

const dataDir = flagValue(process.argv.slice(2), '--data-dir');
if (!dataDir) {
  console.error('usage: mint-admin-token.ts --data-dir <dir>');
  process.exit(1);
}
const dbPath = join(resolve(dataDir), 'aepbase.db');
if (!existsSync(dbPath)) {
  console.error(`no database at ${dbPath}`);
  process.exit(1);
}
const db = new Database(dbPath);
try {
  const { token, userId } = mintAdminToken(db);
  console.log('@@HOMESTEAD_TOKEN@@' + JSON.stringify({ token, userId }));
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
} finally {
  db.close();
}
