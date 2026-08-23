/**
 * `homestead backup` — archive the data directory (sqlite databases + files).
 *
 * Two things this command has to get right:
 *
 * 1. **A consistent database.** The databases run in WAL mode, so tarring the
 *    live `<name>.db` + `-wal` + `-shm` while the server writes can capture an
 *    inconsistent set. Instead each database is snapshotted with `VACUUM INTO`
 *    (a runtime child of the project's homestead-server, see
 *    `homestead-server/src/snapshot.ts`) and the snapshot is what gets
 *    archived; the live db files are excluded.
 *
 * 2. **An honest description of what it produced.** Encryption at rest is
 *    opt-in and covers only file bytes and extracted-text columns, so the
 *    archive is either fully plaintext (no master key) or partly plaintext
 *    (structured fields, the search index, account rows). The summary says
 *    which, rather than claiming the archive is safe to store anywhere.
 *
 * The master key itself must never ride along: the command refuses to run if
 * the key file lives inside the data dir.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { loadProject } from './project.ts';
import { resolveKeyLocation, type KeyLocation } from './key.ts';
import { findRuntime, resolveServerModule } from './runtime.ts';

/** True if `child` is the same path as, or nested inside, `parent`. */
export function isInside(parent: string, child: string): boolean {
  const p = resolve(parent);
  const c = resolve(child);
  return c === p || c.startsWith(p + sep);
}

/** SQLite sidecars that must not be archived alongside a `VACUUM INTO` copy. */
const DB_SIDECAR_SUFFIXES = ['-wal', '-shm', '-journal'];

/**
 * Split a data dir's top-level entries into the live database artifacts (which
 * the snapshot replaces) and everything else (`files/`, and anything an
 * operator or a future release puts there), which is archived as-is.
 *
 * Passing an explicit operand list to tar rather than `--exclude` patterns
 * keeps the behavior identical on GNU tar and bsdtar.
 */
export function partitionDataDir(entries: string[]): { dbArtifacts: string[]; others: string[] } {
  const dbArtifacts: string[] = [];
  const others: string[] = [];
  for (const name of entries) {
    const isDb =
      name.endsWith('.db') ||
      DB_SIDECAR_SUFFIXES.some((suffix) => name.endsWith(`.db${suffix}`));
    (isDb ? dbArtifacts : others).push(name);
  }
  return { dbArtifacts, others };
}

/** How much of the archive the master key actually protects. */
export type EncryptionState = 'on' | 'off';

export function encryptionState(key: KeyLocation): EncryptionState {
  return key.source !== 'none' && key.value ? 'on' : 'off';
}

function humanBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${i === 0 ? n : n.toFixed(1)} ${units[i]}`;
}

/**
 * The post-backup summary. Split out from the command so the wording is
 * testable — getting this wrong is how an operator ends up treating a
 * plaintext copy of their household as safe to hand around.
 */
export function summaryLines(state: EncryptionState, key: KeyLocation): string[] {
  if (state === 'off') {
    return [
      '  ⚠  Encryption at rest is OFF — this archive is PLAINTEXT.',
      '     It holds your whole household database and every uploaded file.',
      "     Store it the way you'd store the data directory itself: somewhere",
      '     private, not a shared drive or a bucket you treat as public.',
      '',
      '     `homestead key generate` turns encryption on for file bytes and',
      '     extracted text from that point forward (it does not re-encrypt',
      '     data already written).',
    ];
  }
  const keyHint =
    key.source === 'env'
      ? 'it lives only in this instance\'s environment (HOMESTEAD_MASTER_KEY)'
      : `it lives at ${key.path}`;
  return [
    '  Encryption at rest is ON, so in this archive:',
    '    encrypted  uploaded file bytes, extracted-text columns',
    '    PLAINTEXT  structured fields (names, amounts, card numbers), the',
    '               search index (vectors.db), and account rows (password',
    '               hashes, tokens)',
    '',
    '  Treat it as sensitive — it is not safe to store just anywhere.',
    '',
    `  Your master key is NOT in the archive — ${keyHint}.`,
    '  Keep a copy somewhere separate (`homestead key show` prints it);',
    '  without it the encrypted files cannot be restored.',
  ];
}

export interface BackupOptions {
  dataDir?: string;
  out?: string;
  stamp?: string;
}

/**
 * Captures the data dir's databases into `outDir`, returning the snapshot
 * filenames (or null when it failed, having already reported why). Injectable
 * so the command's archive assembly can be tested without a live server —
 * `homestead-server/test/snapshot.test.ts` covers the real VACUUM INTO.
 */
export type Snapshotter = (dataDir: string, outDir: string) => string[] | null;

export function backupCmd(
  opts: BackupOptions,
  snapshot: Snapshotter = snapshotViaServer,
): number {
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

  if (!existsSync(dataDir)) {
    console.error(`no data directory at ${dataDir} — nothing to back up`);
    return 1;
  }

  // Guard: the master key must never ride along in the archive.
  const key = resolveKeyLocation();
  if (key.path && isInside(dataDir, key.path)) {
    console.error(
      `master key ${key.path} is inside the data dir ${dataDir}.\n` +
        'Backing that up would defeat encryption-at-rest. Move the key outside the\n' +
        'data dir (e.g. `homestead key generate` writes to ~/.homestead) and retry.',
    );
    return 1;
  }

  const out = resolve(opts.out ?? `homestead-backup-${opts.stamp ?? 'latest'}.tar.gz`);
  const staging = mkdtempSync(join(tmpdir(), 'homestead-backup-'));
  try {
    const snapshotDir = join(staging, 'db');
    mkdirSync(snapshotDir, { recursive: true });
    const databases = snapshot(dataDir, snapshotDir);
    if (databases === null) return 1;

    const { others } = partitionDataDir(readdirSync(dataDir));
    if (databases.length === 0 && others.length === 0) {
      console.error(`${dataDir} is empty — nothing to back up`);
      return 1;
    }

    // Two -C groups: the snapshotted databases, then the rest of the data dir.
    // Both land at the archive root, so the archive is a drop-in data dir.
    const args = ['-czf', out];
    if (databases.length > 0) args.push('-C', snapshotDir, ...databases);
    if (others.length > 0) args.push('-C', dataDir, ...others);

    const result = spawnSync('tar', args, { stdio: 'inherit' });
    if (result.error || result.status !== 0) {
      console.error(
        `tar failed: ${result.error ? result.error.message : `exit ${result.status}`}`,
      );
      return 1;
    }
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }

  console.log(`wrote ${out} (${humanBytes(statSync(out).size)})`);
  console.log('');
  for (const line of summaryLines(encryptionState(key), key)) console.log(line);
  return 0;
}

/**
 * The real snapshotter: runs `tools/snapshot.ts` as a runtime child of the
 * project's homestead-server, so the SQLite driver always matches the version
 * that owns the db (same rule as `homestead admin reset-password`).
 */
function snapshotViaServer(dataDir: string, outDir: string): string[] | null {
  let tool: string;
  try {
    tool = resolveServerModule('.', 'tools', 'snapshot.ts');
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return null;
  }

  const cmd = findRuntime('.').run(tool, ['--data-dir', dataDir, '--out-dir', outDir]);
  const result = spawnSync(cmd[0]!, cmd.slice(1), {
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf8',
  });
  if (result.error || result.status !== 0) {
    console.error(
      `database snapshot failed: ${
        result.error ? result.error.message : `exit ${result.status}`
      }`,
    );
    return null;
  }

  try {
    const report = JSON.parse(result.stdout.trim()) as { databases: Array<{ name: string }> };
    return report.databases.map((d) => d.name);
  } catch {
    console.error('database snapshot produced no readable report');
    return null;
  }
}
