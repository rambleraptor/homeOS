import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backupCmd } from './backup.ts';
import { checkKey, restoreCmd } from './restore.ts';
import { MANIFEST_FORMAT, MANIFEST_NAME, type BackupManifest } from './manifest.ts';
import { keyFingerprint } from './key.ts';

let dir: string;
const savedEnv = { ...process.env };
let logged: string[];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hs-restore-'));
  delete process.env.HOMESTEAD_MASTER_KEY;
  delete process.env.HOMESTEAD_MASTER_KEY_FILE;
  logged = [];
  const capture = (...args: unknown[]) => void logged.push(args.map(String).join(' '));
  vi.spyOn(console, 'log').mockImplementation(capture);
  vi.spyOn(console, 'error').mockImplementation(capture);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  process.env = { ...savedEnv };
  vi.restoreAllMocks();
});

const KEY_A = Buffer.alloc(32, 1).toString('base64');
const KEY_B = Buffer.alloc(32, 2).toString('base64');

/** The databases are stand-ins; real snapshots are covered server-side. */
function fakeSnapshot(dataDir: string, outDir: string): string[] {
  const names = readdirSync(dataDir).filter((n) => n.endsWith('.db'));
  for (const name of names) writeFileSync(join(outDir, name), `snapshot of ${name}`);
  return names.sort();
}

const dbAlwaysOk = () => true;

function seedDataDir(path: string): void {
  mkdirSync(join(path, 'files', 'gift-cards'), { recursive: true });
  writeFileSync(join(path, 'aepbase.db'), 'live db');
  writeFileSync(join(path, 'aepbase.db-wal'), 'wal');
  writeFileSync(join(path, 'files', 'gift-cards', 'front_image'), 'blob bytes');
}

/** Back up a freshly seeded data dir and return the archive path. */
function makeArchive(name = 'backup.tar.gz'): string {
  const source = join(dir, 'source');
  seedDataDir(source);
  const archive = join(dir, name);
  expect(backupCmd({ dataDir: source, out: archive }, fakeSnapshot)).toBe(0);
  return archive;
}

function manifest(overrides: Partial<BackupManifest> = {}): BackupManifest {
  return {
    format: MANIFEST_FORMAT,
    created_at: '2026-01-01T00:00:00.000Z',
    homestead_version: '0.2.0',
    data_dir_name: 'data',
    encryption: { enabled: false },
    databases: [],
    files: [],
    ...overrides,
  };
}

describe('checkKey', () => {
  test('passes an unencrypted archive, noting the contents are plaintext', () => {
    const verdict = checkKey(manifest(), { source: 'none' });
    expect(verdict.ok).toBe(true);
    expect(verdict.ok && verdict.note).toContain('plaintext');
  });

  test('refuses an encrypted archive when no key is configured', () => {
    const verdict = checkKey(
      manifest({ encryption: { enabled: true, key_id: keyFingerprint(KEY_A) } }),
      { source: 'none' },
    );
    expect(verdict.ok).toBe(false);
    expect(!verdict.ok && verdict.reason).toContain('no master key is configured');
  });

  test('refuses when the configured key is a different one', () => {
    const verdict = checkKey(
      manifest({ encryption: { enabled: true, key_id: keyFingerprint(KEY_A) } }),
      { source: 'env', value: KEY_B },
    );
    expect(verdict.ok).toBe(false);
    expect(!verdict.ok && verdict.reason).toContain('--allow-key-mismatch');
  });

  test('passes when the fingerprints agree', () => {
    expect(
      checkKey(manifest({ encryption: { enabled: true, key_id: keyFingerprint(KEY_A) } }), {
        source: 'env',
        value: KEY_A,
      }).ok,
    ).toBe(true);
  });
});

describe('restoreCmd', () => {
  test('rejects a missing archive', () => {
    expect(restoreCmd({ from: join(dir, 'nope.tar.gz'), dataDir: join(dir, 'data') })).toBe(1);
    expect(logged.join('\n')).toContain('no archive at');
  });

  test('rejects an archive with no manifest', () => {
    const foreign = join(dir, 'foreign.tar.gz');
    const src = join(dir, 'plain');
    mkdirSync(src);
    writeFileSync(join(src, 'aepbase.db'), 'bytes');
    expect(spawnSync('tar', ['-czf', foreign, '-C', src, 'aepbase.db']).status).toBe(0);

    expect(restoreCmd({ from: foreign, dataDir: join(dir, 'data') }, dbAlwaysOk)).toBe(1);
    expect(logged.join('\n')).toContain(MANIFEST_NAME);
  });

  test('restores into an empty data dir', () => {
    const archive = makeArchive();
    const target = join(dir, 'data');

    expect(restoreCmd({ from: archive, dataDir: target }, dbAlwaysOk)).toBe(0);

    expect(readFileSync(join(target, 'aepbase.db'), 'utf8')).toBe('snapshot of aepbase.db');
    expect(readFileSync(join(target, 'files', 'gift-cards', 'front_image'), 'utf8')).toBe(
      'blob bytes',
    );
    // The manifest describes the archive; it is not instance data.
    expect(existsSync(join(target, MANIFEST_NAME))).toBe(false);
  });

  test('refuses to replace a non-empty data dir without --force', () => {
    const archive = makeArchive();
    const target = join(dir, 'data');
    mkdirSync(target);
    writeFileSync(join(target, 'aepbase.db'), 'precious live data');

    expect(restoreCmd({ from: archive, dataDir: target }, dbAlwaysOk)).toBe(1);
    expect(readFileSync(join(target, 'aepbase.db'), 'utf8')).toBe('precious live data');
    expect(logged.join('\n')).toContain('--force');
  });

  test('--force renames the old data dir aside instead of deleting it', () => {
    const archive = makeArchive();
    const target = join(dir, 'data');
    mkdirSync(target);
    writeFileSync(join(target, 'aepbase.db'), 'precious live data');

    expect(
      restoreCmd({ from: archive, dataDir: target, force: true, stamp: '20260101-000000' }, dbAlwaysOk),
    ).toBe(0);

    expect(readFileSync(join(target, 'aepbase.db'), 'utf8')).toBe('snapshot of aepbase.db');
    const kept = `${target}.pre-restore-20260101-000000`;
    expect(readFileSync(join(kept, 'aepbase.db'), 'utf8')).toBe('precious live data');
  });

  test('--verify checks the archive without touching the data dir', () => {
    const archive = makeArchive();
    const target = join(dir, 'data');
    mkdirSync(target);
    writeFileSync(join(target, 'aepbase.db'), 'precious live data');

    expect(restoreCmd({ from: archive, dataDir: target, verify: true }, dbAlwaysOk)).toBe(0);

    expect(readFileSync(join(target, 'aepbase.db'), 'utf8')).toBe('precious live data');
    expect(logged.join('\n')).toContain('intact and restorable');
  });

  test('refuses a corrupted archive and leaves the data dir alone', () => {
    const source = join(dir, 'source');
    seedDataDir(source);
    const staged = join(dir, 'staged');
    mkdirSync(staged);
    const archive = join(dir, 'backup.tar.gz');
    expect(backupCmd({ dataDir: source, out: archive }, fakeSnapshot)).toBe(0);

    // Rebuild the tarball with one file's bytes altered, manifest untouched.
    expect(spawnSync('tar', ['-xzf', archive, '-C', staged]).status).toBe(0);
    writeFileSync(join(staged, 'files', 'gift-cards', 'front_image'), 'tampered!');
    rmSync(archive);
    expect(
      spawnSync('tar', ['-czf', archive, '-C', staged, ...readdirSync(staged)]).status,
    ).toBe(0);

    const target = join(dir, 'data');
    expect(restoreCmd({ from: archive, dataDir: target }, dbAlwaysOk)).toBe(1);
    expect(existsSync(target)).toBe(false);
    expect(logged.join('\n')).toContain('does not match its manifest');
  });

  test('refuses when the archive names a different master key', () => {
    process.env.HOMESTEAD_MASTER_KEY = KEY_A;
    const archive = makeArchive();
    process.env.HOMESTEAD_MASTER_KEY = KEY_B;

    const target = join(dir, 'data');
    expect(restoreCmd({ from: archive, dataDir: target }, dbAlwaysOk)).toBe(1);
    expect(existsSync(target)).toBe(false);
    expect(logged.join('\n')).toContain('was written under master key');
  });

  test('--allow-key-mismatch overrides the key check', () => {
    process.env.HOMESTEAD_MASTER_KEY = KEY_A;
    const archive = makeArchive();
    process.env.HOMESTEAD_MASTER_KEY = KEY_B;

    const target = join(dir, 'data');
    expect(
      restoreCmd({ from: archive, dataDir: target, allowKeyMismatch: true }, dbAlwaysOk),
    ).toBe(0);
    expect(existsSync(join(target, 'aepbase.db'))).toBe(true);
  });

  test('stops when a database fails its integrity check', () => {
    const archive = makeArchive();
    const target = join(dir, 'data');

    expect(restoreCmd({ from: archive, dataDir: target }, () => false)).toBe(1);
    expect(existsSync(target)).toBe(false);
  });

  test('leaves no staging directory behind', () => {
    const archive = makeArchive();
    const target = join(dir, 'data');
    expect(restoreCmd({ from: archive, dataDir: target }, dbAlwaysOk)).toBe(0);
    expect(readdirSync(dir).filter((n) => n.startsWith('.homestead-restore-'))).toEqual([]);
  });
});
