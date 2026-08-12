/**
 * Backup + restore round-trips a data directory: databases are snapshotted
 * with VACUUM INTO (crash-consistent, no torn WAL), the files tree rides
 * along, and restore replaces data safely with an integrity check.
 */

import { afterEach, describe, expect, test } from 'vitest';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Database } from '../src/engine/sqlite';
import { runBackup, runRestore } from '../src/backup';

const dirs: string[] = [];

function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(d);
  return d;
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

/** Seed a data dir with a WAL-mode aepbase.db (+ a row), a vectors.db, and a file. */
function seedDataDir(): { dataDir: string } {
  const dataDir = tmp('hs-backup-src-');
  const db = new Database(join(dataDir, 'aepbase.db'));
  db.run('PRAGMA journal_mode=WAL');
  db.run('CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT)');
  db.run('INSERT INTO notes (id, body) VALUES (?, ?)', 1, 'keep me');
  db.close();

  const vec = new Database(join(dataDir, 'vectors.db'));
  vec.run('PRAGMA journal_mode=WAL');
  vec.run('CREATE TABLE v (id INTEGER)');
  vec.close();

  mkdirSync(join(dataDir, 'files'), { recursive: true });
  writeFileSync(join(dataDir, 'files', 'doc.bin'), 'ciphertext-bytes');
  return { dataDir };
}

describe('backup + restore', () => {
  test('round-trips databases and files, snapshot is clean (no -wal)', () => {
    const { dataDir } = seedDataDir();
    const out = join(tmp('hs-backup-out-'), 'backup.tar.gz');

    const result = runBackup({ dataDir, out });
    expect(existsSync(out)).toBe(true);
    expect(result.databases).toEqual(['aepbase.db', 'vectors.db']);
    expect(result.includedFiles).toBe(true);

    const target = tmp('hs-backup-dst-');
    // runRestore refuses a non-empty dir without force, so use a fresh one.
    rmSync(target, { recursive: true, force: true });
    const restored = runRestore({ dataDir: target, archive: out });

    // The database and its row survived.
    const db = new Database(join(target, 'aepbase.db'));
    const row = db.query('SELECT body FROM notes WHERE id=1').get() as { body: string };
    db.close();
    expect(row.body).toBe('keep me');

    // The file tree survived.
    expect(readFileSync(join(target, 'files', 'doc.bin'), 'utf8')).toBe('ciphertext-bytes');

    // The snapshot is a fresh, checkpointed db: no WAL sidecar rode along.
    expect(existsSync(join(target, 'aepbase.db-wal'))).toBe(false);

    // Integrity check passed for every restored db.
    expect(restored.integrity.every((c) => c.ok)).toBe(true);
    expect(restored.databases).toEqual(['aepbase.db', 'vectors.db']);
  });

  test('refuses to overwrite a populated data dir without --force', () => {
    const { dataDir } = seedDataDir();
    const out = join(tmp('hs-backup-out-'), 'backup.tar.gz');
    runBackup({ dataDir, out });

    // Restoring back over the (still-populated) source must refuse.
    expect(() => runRestore({ dataDir, archive: out })).toThrow(/already contains a database/);
  });

  test('--force clears a stale WAL sidecar before restoring', () => {
    const { dataDir } = seedDataDir();
    const out = join(tmp('hs-backup-out-'), 'backup.tar.gz');
    runBackup({ dataDir, out });

    // Simulate a leftover -wal next to the old db in the restore target: it must
    // be removed, or SQLite could apply stale frames onto the restored file.
    const target = seedDataDir().dataDir;
    writeFileSync(join(target, 'aepbase.db-wal'), 'stale-frames');

    const restored = runRestore({ dataDir: target, archive: out, force: true });
    expect(existsSync(join(target, 'aepbase.db-wal'))).toBe(false);
    expect(restored.integrity.every((c) => c.ok)).toBe(true);
  });

  test('backup errors on a missing data dir', () => {
    const out = join(tmp('hs-backup-out-'), 'backup.tar.gz');
    expect(() => runBackup({ dataDir: '/no/such/homestead/dir', out })).toThrow(/no data directory/);
  });
});
