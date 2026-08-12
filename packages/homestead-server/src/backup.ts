/**
 * Crash-consistent backup + restore of a Homestead data directory.
 *
 * A data dir holds one or more SQLite databases (`aepbase.db`, `vectors.db`,
 * and any future ones) plus the `files/` upload tree. The databases run in WAL
 * mode, so a plain `tar` of the live directory can capture a torn snapshot —
 * the `-wal` sidecar and the main file are read at different instants. Instead
 * we snapshot each database with `VACUUM INTO`, which writes a fully
 * checkpointed, single-file copy of the last committed state from a separate
 * connection — safe to run against a live server, no downtime — and archive
 * those clean copies alongside `files/`.
 *
 * The master key is never part of a backup (it lives outside the data dir by
 * design); the archived database bytes are ciphertext under encryption-at-rest
 * and useless without it. The key guard lives in the CLI layer that calls this.
 *
 * These run as a child of the project's homestead-server (see
 * `tools/backup.ts` / `tools/restore.ts`) so the launcher binary bundles no
 * engine code and the SQLite handling matches the server that owns the db.
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Database } from './engine/sqlite';

const FILES_DIR = 'files';

/** WAL/SHM sidecars of a `<name>.db`, in the order safe to remove. */
function sidecars(dbFile: string): string[] {
  return [`${dbFile}-wal`, `${dbFile}-shm`];
}

/** The `*.db` files in `dataDir` (excluding `-wal`/`-shm` sidecars). */
function databaseFiles(dataDir: string): string[] {
  return readdirSync(dataDir)
    .filter((f) => f.endsWith('.db'))
    .sort();
}

export interface BackupResult {
  /** Absolute-or-given path of the archive written. */
  out: string;
  /** Database files snapshotted into the archive. */
  databases: string[];
  /** Whether the `files/` tree was present and included. */
  includedFiles: boolean;
}

/**
 * Write a crash-consistent `.tar.gz` of `dataDir` to `out`. Each `*.db` is
 * snapshotted with `VACUUM INTO` (a checkpointed, consistent copy) into a temp
 * staging dir; the archive contains those clean copies plus `files/`, so it
 * carries no WAL sidecars and never a torn database.
 */
export function runBackup(opts: { dataDir: string; out: string }): BackupResult {
  const { dataDir, out } = opts;
  if (!existsSync(dataDir)) {
    throw new Error(`no data directory at ${dataDir} — nothing to back up`);
  }

  const dbs = databaseFiles(dataDir);
  if (dbs.length === 0 && !existsSync(join(dataDir, FILES_DIR))) {
    throw new Error(`data directory ${dataDir} has no databases or files — nothing to back up`);
  }

  const staging = mkdtempSync(join(tmpdir(), 'homestead-backup-'));
  try {
    // Snapshot each database into staging. VACUUM INTO requires the target not
    // exist; staging is freshly created, so each name is clear.
    for (const dbFile of dbs) {
      const db = new Database(join(dataDir, dbFile));
      try {
        db.run('VACUUM INTO ?', join(staging, dbFile));
      } finally {
        db.close();
      }
    }

    // One archive: the clean db snapshots (from staging) plus files/ (from the
    // live dir). tar's repeated `-C dir member` switches let us pull members
    // from two roots without copying the (potentially large) files tree.
    const args = ['-czf', out];
    for (const dbFile of dbs) args.push('-C', staging, dbFile);
    const includedFiles = existsSync(join(dataDir, FILES_DIR));
    if (includedFiles) args.push('-C', dataDir, FILES_DIR);

    const res = spawnSync('tar', args, { stdio: ['ignore', 'ignore', 'inherit'] });
    if (res.error || res.status !== 0) {
      throw new Error(`tar failed: ${res.error ? res.error.message : `exit ${res.status}`}`);
    }
    return { out, databases: dbs, includedFiles };
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

export interface RestoreResult {
  /** Database files found in the restored data dir. */
  databases: string[];
  /** Result of `PRAGMA integrity_check` on each restored database. */
  integrity: Array<{ database: string; ok: boolean; detail: string }>;
}

/**
 * Restore a `.tar.gz` written by {@link runBackup} into `dataDir`, then verify
 * each restored database with `PRAGMA integrity_check`.
 *
 * Refuses to overwrite a data dir that already contains a database unless
 * `force` is set — a restore replaces data, so it must be deliberate. Stop the
 * server first; restoring under a live server is unsupported. With `force`, any
 * existing databases and their stale WAL/SHM sidecars are removed before
 * extraction so a leftover `-wal` can't corrupt a freshly restored file.
 */
export function runRestore(opts: {
  dataDir: string;
  archive: string;
  force?: boolean;
}): RestoreResult {
  const { dataDir, archive, force = false } = opts;
  if (!existsSync(archive)) {
    throw new Error(`no archive at ${archive}`);
  }

  const existingDbs = existsSync(dataDir) ? databaseFiles(dataDir) : [];
  if (existingDbs.length > 0 && !force) {
    throw new Error(
      `${dataDir} already contains a database (${existingDbs.join(', ')}).\n` +
        'Restoring replaces its data. Stop the server, then re-run with --force ' +
        '(or restore into an empty --data-dir).',
    );
  }

  // Clear existing databases + their sidecars so a stale -wal can't be applied
  // on top of a restored file. files/ is left to be overwritten by extraction.
  for (const dbFile of existingDbs) {
    for (const p of [dbFile, ...sidecars(dbFile)]) {
      rmSync(join(dataDir, p), { force: true });
    }
  }

  mkdirSync(dataDir, { recursive: true });
  const res = spawnSync('tar', ['-xzf', archive, '-C', dataDir], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  if (res.error || res.status !== 0) {
    throw new Error(
      `tar extraction failed: ${res.error ? res.error.message : `exit ${res.status}`}`,
    );
  }

  const integrity = databaseFiles(dataDir).map((dbFile) => {
    const db = new Database(join(dataDir, dbFile));
    try {
      const row = db.query('PRAGMA integrity_check').get() as
        | { integrity_check?: string }
        | null;
      const detail = row?.integrity_check ?? 'no result';
      return { database: dbFile, ok: detail === 'ok', detail };
    } finally {
      db.close();
    }
  });

  return { databases: integrity.map((i) => i.database), integrity };
}
