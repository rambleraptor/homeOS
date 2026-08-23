import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Database } from '../src/engine/sqlite';
import { checkDatabase, findDatabases, snapshotAll, snapshotDatabase } from '../src/snapshot';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hs-snapshot-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** A WAL-mode database with one row, matching how the engine opens its dbs. */
function seedDb(path: string, value = 'hello'): void {
  const db = new Database(path, { create: true });
  db.run('PRAGMA journal_mode=WAL');
  db.run('CREATE TABLE t (x TEXT)');
  db.run('INSERT INTO t VALUES (?)', value);
  db.close();
}

describe('findDatabases', () => {
  test('returns top-level *.db files, sorted, ignoring sidecars', () => {
    seedDb(join(dir, 'aepbase.db'));
    seedDb(join(dir, 'vectors.db'));
    writeFileSync(join(dir, 'aepbase.db-wal'), '');
    writeFileSync(join(dir, 'aepbase.db-shm'), '');
    mkdirSync(join(dir, 'files'));

    expect(findDatabases(dir)).toEqual(['aepbase.db', 'vectors.db']);
  });

  test('ignores a directory that happens to end in .db', () => {
    mkdirSync(join(dir, 'not-really.db'));
    expect(findDatabases(dir)).toEqual([]);
  });
});

describe('snapshotDatabase', () => {
  test('writes a self-contained copy with the source rows', () => {
    const src = join(dir, 'aepbase.db');
    seedDb(src, 'row-one');
    const dest = join(dir, 'snap.db');

    const bytes = snapshotDatabase(src, dest);

    expect(bytes).toBeGreaterThan(0);
    // No -wal/-shm sidecar: VACUUM INTO folds the WAL into one file.
    expect(existsSync(`${dest}-wal`)).toBe(false);
    const copy = new Database(dest);
    expect(copy.query('SELECT x FROM t').all()).toEqual([{ x: 'row-one' }]);
    copy.close();
  });

  test('captures rows committed while the source stays open', () => {
    const src = join(dir, 'aepbase.db');
    seedDb(src);
    // Hold the source open the way a running server would.
    const live = new Database(src);
    live.run('INSERT INTO t VALUES (?)', 'written-by-live-server');
    try {
      snapshotDatabase(src, join(dir, 'snap.db'));
    } finally {
      live.close();
    }

    const copy = new Database(join(dir, 'snap.db'));
    expect(copy.query('SELECT x FROM t ORDER BY x').all()).toEqual([
      { x: 'hello' },
      { x: 'written-by-live-server' },
    ]);
    copy.close();
  });

  test('refuses to overwrite a destination that already holds data', () => {
    const src = join(dir, 'aepbase.db');
    seedDb(src);
    const dest = join(dir, 'snap.db');
    writeFileSync(dest, 'existing contents');

    expect(() => snapshotDatabase(src, dest)).toThrow();
  });
});

describe('checkDatabase', () => {
  test('passes on a healthy database', () => {
    const path = join(dir, 'ok.db');
    seedDb(path);
    expect(() => checkDatabase(path)).not.toThrow();
  });

  test('throws on a file that is not a database', () => {
    const path = join(dir, 'junk.db');
    writeFileSync(path, 'this is not sqlite');
    expect(() => checkDatabase(path)).toThrow();
  });
});

describe('snapshotAll', () => {
  test('snapshots every database and reports sizes', () => {
    seedDb(join(dir, 'aepbase.db'));
    seedDb(join(dir, 'vectors.db'));
    const out = join(dir, 'staging');
    mkdirSync(out);

    const seen: string[] = [];
    const report = snapshotAll(dir, out, (entry) => seen.push(entry.name));

    expect(report.databases.map((d) => d.name)).toEqual(['aepbase.db', 'vectors.db']);
    expect(report.databases.every((d) => d.bytes > 0)).toBe(true);
    expect(seen).toEqual(['aepbase.db', 'vectors.db']);
    expect(existsSync(join(out, 'aepbase.db'))).toBe(true);
    expect(existsSync(join(out, 'vectors.db'))).toBe(true);
  });
});
