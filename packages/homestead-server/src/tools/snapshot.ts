/**
 * `bun tools/snapshot.ts --data-dir <dir> --out-dir <dir>`
 *
 * Writes a consistent copy of every SQLite database in the data dir into
 * `--out-dir`, for `homestead backup` to archive. See `../snapshot.ts` for why
 * a plain file copy of a live WAL database is not safe.
 *
 * Invoked by the launcher as a runtime child (like `tools/reset-password.ts`)
 * so the binary never bundles engine code: the SQLite driver always comes from
 * the project's homestead-server version, matching the db it reads.
 *
 * Prints a JSON `SnapshotReport` on stdout; progress goes to stderr.
 */

import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { snapshotAll } from '../snapshot';
import { flagValue } from './flags';

const argv = process.argv.slice(2);
const dataDirArg = flagValue(argv, '--data-dir');
const outDirArg = flagValue(argv, '--out-dir');
if (!dataDirArg || !outDirArg) {
  console.error('usage: snapshot.ts --data-dir <dir> --out-dir <dir>');
  process.exit(1);
}

const dataDir = resolve(dataDirArg);
if (!existsSync(dataDir)) {
  console.error(`no data directory at ${dataDir}`);
  process.exit(1);
}
const outDir = resolve(outDirArg);
mkdirSync(outDir, { recursive: true });

try {
  const report = snapshotAll(dataDir, outDir, ({ name, bytes }) =>
    console.error(`  snapshot ${name} (${bytes} bytes)`),
  );
  process.stdout.write(`${JSON.stringify(report)}\n`);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
