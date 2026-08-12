/**
 * `bun tools/backup.ts --data-dir <dir> --out <archive>`
 *
 * Writes a crash-consistent archive of the data dir (see ../backup). Invoked by
 * the launcher (`homestead backup`) as a child of the project's
 * homestead-server so the binary never bundles engine/SQLite code — the
 * snapshot logic always matches the server version that owns the db.
 */

import { runBackup } from '../backup';

function flagValue(argv: string[], name: string): string | undefined {
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = argv.indexOf(name);
  return i !== -1 ? argv[i + 1] : undefined;
}

const argv = process.argv.slice(2);
const dataDir = flagValue(argv, '--data-dir');
const out = flagValue(argv, '--out');
if (!dataDir || !out) {
  console.error('usage: backup.ts --data-dir <dir> --out <archive>');
  process.exit(1);
}

try {
  const result = runBackup({ dataDir, out });
  console.log(`wrote ${result.out}`);
  console.log(`  databases: ${result.databases.join(', ') || '(none)'}`);
  console.log(`  files:     ${result.includedFiles ? 'included' : '(none)'}`);
  console.log('');
  console.log('  This archive is ciphertext and safe to store anywhere.');
  console.log('  Your master key is NOT in it — keep that stored separately');
  console.log('  (`homestead key show` prints it). The archive is useless without it.');
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
