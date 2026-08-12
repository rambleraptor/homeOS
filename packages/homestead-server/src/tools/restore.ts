/**
 * `bun tools/restore.ts --data-dir <dir> --archive <path> [--force]`
 *
 * Restores an archive written by `tools/backup.ts` into the data dir and
 * verifies each database with an integrity check (see ../backup). Invoked by
 * the launcher (`homestead restore`) as a child of the project's
 * homestead-server so the binary bundles no engine/SQLite code.
 *
 * Refuses to overwrite a populated data dir unless --force. Stop the server
 * before restoring — restoring under a live server is unsupported.
 */

import { runRestore } from '../backup';

function flagValue(argv: string[], name: string): string | undefined {
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = argv.indexOf(name);
  return i !== -1 ? argv[i + 1] : undefined;
}

const argv = process.argv.slice(2);
const dataDir = flagValue(argv, '--data-dir');
const archive = flagValue(argv, '--archive');
const force = argv.includes('--force');
if (!dataDir || !archive) {
  console.error('usage: restore.ts --data-dir <dir> --archive <path> [--force]');
  process.exit(1);
}

try {
  const result = runRestore({ dataDir, archive, force });
  console.log(`restored into ${dataDir}`);
  let failed = false;
  for (const check of result.integrity) {
    console.log(`  ${check.database}: integrity ${check.ok ? 'ok' : `FAILED — ${check.detail}`}`);
    if (!check.ok) failed = true;
  }
  if (failed) {
    console.error('\nOne or more databases failed their integrity check — the backup may be corrupt.');
    process.exit(1);
  }
  console.log('\nStart the server to pick up the restored data.');
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
