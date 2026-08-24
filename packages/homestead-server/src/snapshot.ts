/**
 * Consistent point-in-time copies of the instance's SQLite databases.
 *
 * The databases run in WAL mode (`engine/db.ts`), so a plain file copy of
 * `<name>.db` + `-wal` + `-shm` taken while the server is writing captures the
 * three files at different instants and can restore inconsistent or corrupt.
 * `VACUUM INTO` runs inside a read transaction, so its output is a single
 * self-contained file reflecting one committed state of the source — no
 * quiesce, no downtime, no `-wal` sidecar to keep in sync.
 *
 * Used by `homestead backup` (through `tools/snapshot.ts`) and by
 * `homestead restore --verify` (through `tools/verify-db.ts`).
 */

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Database } from './engine/sqlite';

/** One database captured into the staging dir. */
export interface SnapshotEntry {
  name: string;
  bytes: number;
}

/** Report emitted on stdout by `tools/snapshot.ts`, parsed by the launcher. */
export interface SnapshotReport {
  databases: SnapshotEntry[];
}

/**
 * Top-level `*.db` files in the data dir. The server creates `aepbase.db` and
 * `vectors.db` there (`server.ts`); discovering rather than hardcoding means a
 * database added later is captured without touching this code.
 */
export function findDatabases(dataDir: string): string[] {
  return readdirSync(dataDir)
    .filter((name) => name.endsWith('.db'))
    .filter((name) => statSync(join(dataDir, name)).isFile())
    .sort();
}

/**
 * Run `PRAGMA quick_check` and throw unless it reports `ok`. Used on a fresh
 * snapshot and again on a restore candidate — a backup that silently captures
 * (or restores) a broken database is the failure this code exists to prevent,
 * so it fails loudly rather than deferring the discovery to restore day.
 */
export function checkDatabase(path: string): void {
  const db = new Database(path);
  let rows: Array<Record<string, unknown>>;
  try {
    rows = db.query('PRAGMA quick_check').all() as Array<Record<string, unknown>>;
  } finally {
    db.close();
  }
  const results = rows.map((r) => String(Object.values(r)[0]));
  if (results.length !== 1 || results[0] !== 'ok') {
    throw new Error(
      `integrity check failed on ${path}: ${results.join('; ') || 'no result'}`,
    );
  }
}

/**
 * `VACUUM INTO` one database, then integrity-check the copy. Returns the size
 * of the snapshot in bytes. SQLite refuses to write over a destination that
 * already holds data, which is the behavior we want — callers snapshot into a
 * fresh staging dir.
 */
export function snapshotDatabase(srcPath: string, destPath: string): number {
  const db = new Database(srcPath);
  try {
    db.query('VACUUM INTO ?').run(destPath);
  } finally {
    db.close();
  }
  checkDatabase(destPath);
  return statSync(destPath).size;
}

/** Snapshot every database in `dataDir` into `outDir`. */
export function snapshotAll(
  dataDir: string,
  outDir: string,
  onEach?: (entry: SnapshotEntry) => void,
): SnapshotReport {
  const databases: SnapshotEntry[] = [];
  for (const name of findDatabases(dataDir)) {
    const bytes = snapshotDatabase(join(dataDir, name), join(outDir, name));
    const entry = { name, bytes };
    onEach?.(entry);
    databases.push(entry);
  }
  return { databases };
}
