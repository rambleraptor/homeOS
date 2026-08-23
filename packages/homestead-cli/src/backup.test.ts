import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  backupCmd,
  encryptionState,
  isInside,
  partitionDataDir,
  summaryLines,
} from './backup.ts';
import { resolveKeyLocation } from './key.ts';

let dir: string;
const savedEnv = { ...process.env };
let logged: string[];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hs-backup-'));
  delete process.env.HOMESTEAD_MASTER_KEY;
  delete process.env.HOMESTEAD_MASTER_KEY_FILE;
  logged = [];
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logged.push(args.map(String).join(' '));
  });
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    logged.push(args.map(String).join(' '));
  });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  process.env = { ...savedEnv };
  vi.restoreAllMocks();
});

describe('isInside', () => {
  test('matches the dir itself and anything nested', () => {
    expect(isInside('/data', '/data')).toBe(true);
    expect(isInside('/data', '/data/files/x')).toBe(true);
  });

  test('does not match a sibling with a shared prefix', () => {
    expect(isInside('/data', '/data-other/key')).toBe(false);
    expect(isInside('/data', '/elsewhere')).toBe(false);
  });
});

describe('partitionDataDir', () => {
  test('separates live database artifacts from everything else', () => {
    const { dbArtifacts, others } = partitionDataDir([
      'aepbase.db',
      'aepbase.db-wal',
      'aepbase.db-shm',
      'aepbase.db-journal',
      'vectors.db',
      'files',
      'notes.txt',
    ]);

    expect(dbArtifacts).toEqual([
      'aepbase.db',
      'aepbase.db-wal',
      'aepbase.db-shm',
      'aepbase.db-journal',
      'vectors.db',
    ]);
    expect(others).toEqual(['files', 'notes.txt']);
  });
});

describe('encryptionState', () => {
  test('is off with no key configured', () => {
    expect(encryptionState({ source: 'none' })).toBe('off');
  });

  test('is off when a key file is configured but missing on disk', () => {
    expect(encryptionState({ source: 'file', path: '/nope/master.key' })).toBe('off');
  });

  test('is on with a resolvable key', () => {
    expect(encryptionState({ source: 'env', value: 'a2V5' })).toBe('on');
  });
});

describe('summaryLines', () => {
  test('warns that the archive is plaintext when encryption is off', () => {
    const text = summaryLines('off', { source: 'none' }).join('\n');
    expect(text).toContain('PLAINTEXT');
    expect(text).toContain('Encryption at rest is OFF');
    // The old wording promised the archive was safe anywhere; it never was.
    expect(text).not.toContain('safe to store anywhere');
  });

  test('scopes the claim to what is actually encrypted when a key is set', () => {
    const text = summaryLines('on', { source: 'file', path: '/keys/master.key', value: 'k' }).join(
      '\n',
    );
    expect(text).toContain('encrypted');
    expect(text).toContain('PLAINTEXT');
    expect(text).toContain('vectors.db');
    expect(text).toContain('/keys/master.key');
    expect(text).not.toContain('safe to store anywhere');
  });

  test('does not point at a key file when the key is only in the environment', () => {
    const text = summaryLines('on', { source: 'env', value: 'k' }).join('\n');
    expect(text).toContain('HOMESTEAD_MASTER_KEY');
  });
});

/**
 * Populate a data dir the way a booted server would: live database artifacts
 * (including the WAL sidecars that must never be archived) plus a files tree.
 * The bytes are stand-ins — the real VACUUM INTO snapshot is covered by
 * `homestead-server/test/snapshot.test.ts`.
 */
function seedDataDir(dataDir: string): void {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, 'aepbase.db'), 'live db, mid-write');
  writeFileSync(join(dataDir, 'aepbase.db-wal'), 'uncommitted pages');
  writeFileSync(join(dataDir, 'aepbase.db-shm'), 'shared memory index');
  writeFileSync(join(dataDir, 'vectors.db'), 'live vector db');
  mkdirSync(join(dataDir, 'files', 'gift-cards'), { recursive: true });
  writeFileSync(join(dataDir, 'files', 'gift-cards', 'front_image'), 'blob bytes');
}

/**
 * Stand-in for the snapshot child: writes a consistent copy of each database
 * into the staging dir, marked so tests can prove the archive carries the
 * snapshot rather than the live file.
 */
function fakeSnapshot(dataDir: string, outDir: string): string[] {
  const names = readdirSync(dataDir).filter((n) => n.endsWith('.db'));
  for (const name of names) writeFileSync(join(outDir, name), `snapshot of ${name}`);
  return names.sort();
}

/** Member names inside a tar.gz, sorted. */
function archiveEntries(archive: string): string[] {
  const res = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`tar -t failed: ${res.stderr}`);
  return res.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .sort();
}

describe('backupCmd', () => {
  test('refuses when the data dir is missing', () => {
    expect(backupCmd({ dataDir: join(dir, 'nope'), out: join(dir, 'b.tar.gz') })).toBe(1);
    expect(logged.join('\n')).toContain('nothing to back up');
  });

  test('refuses when the master key sits inside the data dir', () => {
    const dataDir = join(dir, 'data');
    mkdirSync(dataDir);
    const keyPath = join(dataDir, 'master.key');
    writeFileSync(keyPath, 'a2V5\n');
    process.env.HOMESTEAD_MASTER_KEY_FILE = keyPath;

    expect(backupCmd({ dataDir, out: join(dir, 'b.tar.gz') })).toBe(1);
    expect(logged.join('\n')).toContain('is inside the data dir');
    expect(existsSync(join(dir, 'b.tar.gz'))).toBe(false);
  });

  test('archives the snapshot and the files tree, never the WAL sidecars', () => {
    const dataDir = join(dir, 'data');
    seedDataDir(dataDir);
    const out = join(dir, 'backup.tar.gz');

    expect(backupCmd({ dataDir, out }, fakeSnapshot)).toBe(0);

    const entries = archiveEntries(out);
    expect(entries).toContain('aepbase.db');
    expect(entries).toContain('vectors.db');
    expect(entries).toContain('files/gift-cards/front_image');
    // The whole point: the live WAL/SHM artifacts must not ride along, or a
    // restore could pair a snapshot with a stale write-ahead log.
    expect(entries.some((e) => e.includes('.db-wal'))).toBe(false);
    expect(entries.some((e) => e.includes('.db-shm'))).toBe(false);
  });

  test('archives the snapshot bytes, not the live database file', () => {
    const dataDir = join(dir, 'data');
    seedDataDir(dataDir);
    const out = join(dir, 'backup.tar.gz');
    expect(backupCmd({ dataDir, out }, fakeSnapshot)).toBe(0);

    const restored = join(dir, 'restored');
    mkdirSync(restored);
    expect(spawnSync('tar', ['-xzf', out, '-C', restored]).status).toBe(0);

    expect(readFileSync(join(restored, 'aepbase.db'), 'utf8')).toBe('snapshot of aepbase.db');
    expect(readFileSync(join(restored, 'files', 'gift-cards', 'front_image'), 'utf8')).toBe(
      'blob bytes',
    );
  });

  test('fails without writing an archive when the snapshot fails', () => {
    const dataDir = join(dir, 'data');
    seedDataDir(dataDir);
    const out = join(dir, 'backup.tar.gz');

    expect(backupCmd({ dataDir, out }, () => null)).toBe(1);
    expect(existsSync(out)).toBe(false);
  });

  test('reports plaintext when no master key is configured', () => {
    const dataDir = join(dir, 'data');
    seedDataDir(dataDir);
    expect(resolveKeyLocation().source).toBe('none');

    expect(backupCmd({ dataDir, out: join(dir, 'backup.tar.gz') }, fakeSnapshot)).toBe(0);
    expect(logged.join('\n')).toContain('Encryption at rest is OFF');
  });

  test('scopes the claim when a master key is configured', () => {
    const dataDir = join(dir, 'data');
    seedDataDir(dataDir);
    process.env.HOMESTEAD_MASTER_KEY = Buffer.alloc(32, 7).toString('base64');

    expect(backupCmd({ dataDir, out: join(dir, 'backup.tar.gz') }, fakeSnapshot)).toBe(0);
    const text = logged.join('\n');
    expect(text).toContain('Encryption at rest is ON');
    expect(text).not.toContain('safe to store anywhere');
  });
});
