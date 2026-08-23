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
import { keyFingerprint, resolveKeyLocation } from './key.ts';
import { generateBackupKeypair, recipientFingerprint } from './archive-crypto.ts';
import { __setDefaultBackupKeyPathsForTests } from './backup-key.ts';

let dir: string;
const savedEnv = { ...process.env };
let logged: string[];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hs-backup-'));
  delete process.env.HOMESTEAD_MASTER_KEY;
  // Point at a path inside the temp dir rather than leaving the lookup to fall
  // through to ~/.homestead/master.key — otherwise these tests would behave
  // differently on a machine that happens to have encryption at rest set up.
  process.env.HOMESTEAD_MASTER_KEY_FILE = join(dir, 'absent-master.key');
  delete process.env.HOMESTEAD_BACKUP_IDENTITY;
  delete process.env.HOMESTEAD_BACKUP_RECIPIENT;
  __setDefaultBackupKeyPathsForTests({
    recipient: join(dir, 'absent-recipient.pub'),
    identity: join(dir, 'absent-backup.key'),
  });
  logged = [];
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logged.push(args.map(String).join(' '));
  });
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    logged.push(args.map(String).join(' '));
  });
});

afterEach(() => {
  __setDefaultBackupKeyPathsForTests(undefined);
  rmSync(dir, { recursive: true, force: true });
  process.env = { ...savedEnv };
  vi.restoreAllMocks();
});

describe('isInside', () => {
  test('matches the dir itself and anything nested', async () => {
    expect(isInside('/data', '/data')).toBe(true);
    expect(isInside('/data', '/data/files/x')).toBe(true);
  });

  test('does not match a sibling with a shared prefix', async () => {
    expect(isInside('/data', '/data-other/key')).toBe(false);
    expect(isInside('/data', '/elsewhere')).toBe(false);
  });
});

describe('partitionDataDir', () => {
  test('separates live database artifacts from everything else', async () => {
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
  test('is off with no key configured', async () => {
    expect(encryptionState({ source: 'none' })).toBe('off');
  });

  test('is off when a key file is configured but missing on disk', async () => {
    expect(encryptionState({ source: 'file', path: '/nope/master.key' })).toBe('off');
  });

  test('is on with a resolvable key', async () => {
    expect(encryptionState({ source: 'env', value: 'a2V5' })).toBe('on');
  });
});

describe('summaryLines', () => {
  test('warns that the archive is plaintext when nothing is encrypted', async () => {
    const text = summaryLines({ state: 'off', key: { source: 'none' } }).join('\n');
    expect(text).toContain('This archive is PLAINTEXT');
    // The claim that mattered: the archive itself must never be described as
    // protected when it isn't. (Advice on how to get there is fine.)
    expect(text).not.toMatch(/This archive is encrypted/);
  });

  test('scopes the claim to what is encrypted when only a master key is set', async () => {
    const text = summaryLines({
      state: 'on',
      key: { source: 'file', path: '/keys/master.key', value: 'k' },
    }).join('\n');
    expect(text).toContain('encrypted');
    expect(text).toContain('PLAINTEXT');
    expect(text).toContain('vectors.db');
    expect(text).toContain('/keys/master.key');
    expect(text).not.toMatch(/This archive is encrypted/);
  });

  test('claims end-to-end safety only when encrypted to a backup key', async () => {
    const { recipient } = generateBackupKeypair();
    const text = summaryLines({ state: 'off', key: { source: 'none' }, recipient }).join('\n');

    expect(text).toContain('This archive is encrypted to backup key');
    expect(text).toContain(recipientFingerprint(recipient));
    expect(text).toContain('safe to store anywhere');
    expect(text).toContain('This machine cannot read it back');
    // With no master key the contents are plaintext once opened — say so.
    expect(text).toContain('plaintext');
  });

  test('names both secrets when archive and at-rest encryption are both on', async () => {
    const { recipient } = generateBackupKeypair();
    const text = summaryLines({
      state: 'on',
      key: { source: 'file', path: '/keys/master.key', value: 'k' },
      recipient,
    }).join('\n');

    expect(text).toContain('BOTH secrets');
    expect(text).toContain('the backup identity');
    expect(text).toContain('the master key');
  });

  test('does not point at a key file when the key is only in the environment', async () => {
    const text = summaryLines({ state: 'on', key: { source: 'env', value: 'k' } }).join('\n');
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
  test('refuses when the data dir is missing', async () => {
    expect(await backupCmd({ dataDir: join(dir, 'nope'), out: join(dir, 'b.tar.gz') })).toBe(1);
    expect(logged.join('\n')).toContain('nothing to back up');
  });

  test('refuses when the master key sits inside the data dir', async () => {
    const dataDir = join(dir, 'data');
    mkdirSync(dataDir);
    const keyPath = join(dataDir, 'master.key');
    writeFileSync(keyPath, 'a2V5\n');
    process.env.HOMESTEAD_MASTER_KEY_FILE = keyPath;

    expect(await backupCmd({ dataDir, out: join(dir, 'b.tar.gz') })).toBe(1);
    expect(logged.join('\n')).toContain('is inside the data dir');
    expect(existsSync(join(dir, 'b.tar.gz'))).toBe(false);
  });

  test('archives the snapshot and the files tree, never the WAL sidecars', async () => {
    const dataDir = join(dir, 'data');
    seedDataDir(dataDir);
    const out = join(dir, 'backup.tar.gz');

    expect(await backupCmd({ dataDir, out }, fakeSnapshot)).toBe(0);

    const entries = archiveEntries(out);
    expect(entries).toContain('aepbase.db');
    expect(entries).toContain('vectors.db');
    expect(entries).toContain('files/gift-cards/front_image');
    // The whole point: the live WAL/SHM artifacts must not ride along, or a
    // restore could pair a snapshot with a stale write-ahead log.
    expect(entries.some((e) => e.includes('.db-wal'))).toBe(false);
    expect(entries.some((e) => e.includes('.db-shm'))).toBe(false);
  });

  test('archives the snapshot bytes, not the live database file', async () => {
    const dataDir = join(dir, 'data');
    seedDataDir(dataDir);
    const out = join(dir, 'backup.tar.gz');
    expect(await backupCmd({ dataDir, out }, fakeSnapshot)).toBe(0);

    const restored = join(dir, 'restored');
    mkdirSync(restored);
    expect(spawnSync('tar', ['-xzf', out, '-C', restored]).status).toBe(0);

    expect(readFileSync(join(restored, 'aepbase.db'), 'utf8')).toBe('snapshot of aepbase.db');
    expect(readFileSync(join(restored, 'files', 'gift-cards', 'front_image'), 'utf8')).toBe(
      'blob bytes',
    );
  });

  test('refuses when the data dir holds a file named like the manifest', async () => {
    const dataDir = join(dir, 'data');
    seedDataDir(dataDir);
    writeFileSync(join(dataDir, 'homestead-backup.json'), '{}');
    const out = join(dir, 'backup.tar.gz');

    expect(await backupCmd({ dataDir, out }, fakeSnapshot)).toBe(1);
    expect(logged.join('\n')).toContain('collides with');
    expect(existsSync(out)).toBe(false);
  });

  test('writes a manifest describing the archive', async () => {
    const dataDir = join(dir, 'data');
    seedDataDir(dataDir);
    const out = join(dir, 'backup.tar.gz');
    expect(await backupCmd({ dataDir, out, now: new Date('2026-01-01T00:00:00Z') }, fakeSnapshot)).toBe(0);

    const read = spawnSync('tar', ['-xzOf', out, 'homestead-backup.json'], { encoding: 'utf8' });
    expect(read.status).toBe(0);
    const manifest = JSON.parse(read.stdout);
    expect(manifest.created_at).toBe('2026-01-01T00:00:00.000Z');
    expect(manifest.data_dir_name).toBe('data');
    expect(manifest.databases).toEqual(['aepbase.db', 'vectors.db']);
    expect(manifest.encryption).toEqual({ enabled: false });
    expect(manifest.files.map((f: { path: string }) => f.path)).toEqual([
      'aepbase.db',
      'files/gift-cards/front_image',
      'vectors.db',
    ]);
  });

  test('records the master key fingerprint, never the key', async () => {
    const key = Buffer.alloc(32, 7).toString('base64');
    process.env.HOMESTEAD_MASTER_KEY = key;
    const dataDir = join(dir, 'data');
    seedDataDir(dataDir);
    const out = join(dir, 'backup.tar.gz');
    expect(await backupCmd({ dataDir, out }, fakeSnapshot)).toBe(0);

    const read = spawnSync('tar', ['-xzOf', out, 'homestead-backup.json'], { encoding: 'utf8' });
    const manifest = JSON.parse(read.stdout);
    expect(manifest.encryption.enabled).toBe(true);
    expect(manifest.encryption.key_id).toBe(keyFingerprint(key));
    expect(read.stdout).not.toContain(key);
  });

  test('fails without writing an archive when the snapshot fails', async () => {
    const dataDir = join(dir, 'data');
    seedDataDir(dataDir);
    const out = join(dir, 'backup.tar.gz');

    expect(await backupCmd({ dataDir, out }, () => null)).toBe(1);
    expect(existsSync(out)).toBe(false);
  });

  test('reports plaintext when no master key is configured', async () => {
    const dataDir = join(dir, 'data');
    seedDataDir(dataDir);
    expect(encryptionState(resolveKeyLocation())).toBe('off');

    expect(await backupCmd({ dataDir, out: join(dir, 'backup.tar.gz') }, fakeSnapshot)).toBe(0);
    expect(logged.join('\n')).toContain('This archive is PLAINTEXT');
  });

  test('scopes the claim when a master key is configured', async () => {
    const dataDir = join(dir, 'data');
    seedDataDir(dataDir);
    process.env.HOMESTEAD_MASTER_KEY = Buffer.alloc(32, 7).toString('base64');

    expect(await backupCmd({ dataDir, out: join(dir, 'backup.tar.gz') }, fakeSnapshot)).toBe(0);
    const text = logged.join('\n');
    expect(text).toContain('Encryption at rest is ON');
    expect(text).not.toContain('safe to store anywhere');
  });
});
