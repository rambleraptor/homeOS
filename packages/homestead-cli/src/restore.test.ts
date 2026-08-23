import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backupCmd } from './backup.ts';
import { checkKey, restoreCmd } from './restore.ts';
import { MANIFEST_FORMAT, MANIFEST_NAME, type BackupManifest } from './manifest.ts';
import { keyFingerprint } from './key.ts';
import {
  generateBackupKeypair,
  hasArchiveMagic,
  recipientFingerprint,
} from './archive-crypto.ts';
import { __setDefaultBackupKeyPathsForTests } from './backup-key.ts';

let dir: string;
const savedEnv = { ...process.env };
let logged: string[];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hs-restore-'));
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
  const capture = (...args: unknown[]) => void logged.push(args.map(String).join(' '));
  vi.spyOn(console, 'log').mockImplementation(capture);
  vi.spyOn(console, 'error').mockImplementation(capture);
});

afterEach(() => {
  __setDefaultBackupKeyPathsForTests(undefined);
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
async function makeArchive(name = 'backup.tar.gz', recipient?: string): Promise<string> {
  const source = join(dir, 'source');
  seedDataDir(source);
  const archive = join(dir, name);
  expect(await backupCmd({ dataDir: source, out: archive, recipient }, fakeSnapshot)).toBe(0);
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
  test('passes an unencrypted archive, noting the contents are plaintext', async () => {
    const verdict = checkKey(manifest(), { source: 'none' });
    expect(verdict.ok).toBe(true);
    expect(verdict.ok && verdict.note).toContain('plaintext');
  });

  test('refuses an encrypted archive when no key is configured', async () => {
    const verdict = checkKey(
      manifest({ encryption: { enabled: true, key_id: keyFingerprint(KEY_A) } }),
      { source: 'none' },
    );
    expect(verdict.ok).toBe(false);
    expect(!verdict.ok && verdict.reason).toContain('no master key is configured');
  });

  test('refuses when the configured key is a different one', async () => {
    const verdict = checkKey(
      manifest({ encryption: { enabled: true, key_id: keyFingerprint(KEY_A) } }),
      { source: 'env', value: KEY_B },
    );
    expect(verdict.ok).toBe(false);
    expect(!verdict.ok && verdict.reason).toContain('--allow-key-mismatch');
  });

  test('passes when the fingerprints agree', async () => {
    expect(
      checkKey(manifest({ encryption: { enabled: true, key_id: keyFingerprint(KEY_A) } }), {
        source: 'env',
        value: KEY_A,
      }).ok,
    ).toBe(true);
  });
});

describe('restoreCmd', () => {
  test('rejects a missing archive', async () => {
    expect(await restoreCmd({ from: join(dir, 'nope.tar.gz'), dataDir: join(dir, 'data') })).toBe(1);
    expect(logged.join('\n')).toContain('no archive at');
  });

  test('rejects an archive with no manifest', async () => {
    const foreign = join(dir, 'foreign.tar.gz');
    const src = join(dir, 'plain');
    mkdirSync(src);
    writeFileSync(join(src, 'aepbase.db'), 'bytes');
    expect(spawnSync('tar', ['-czf', foreign, '-C', src, 'aepbase.db']).status).toBe(0);

    expect(await restoreCmd({ from: foreign, dataDir: join(dir, 'data') }, dbAlwaysOk)).toBe(1);
    expect(logged.join('\n')).toContain(MANIFEST_NAME);
  });

  test('restores into an empty data dir', async () => {
    const archive = await makeArchive();
    const target = join(dir, 'data');

    expect(await restoreCmd({ from: archive, dataDir: target }, dbAlwaysOk)).toBe(0);

    expect(readFileSync(join(target, 'aepbase.db'), 'utf8')).toBe('snapshot of aepbase.db');
    expect(readFileSync(join(target, 'files', 'gift-cards', 'front_image'), 'utf8')).toBe(
      'blob bytes',
    );
    // The manifest describes the archive; it is not instance data.
    expect(existsSync(join(target, MANIFEST_NAME))).toBe(false);
  });

  test('refuses to replace a non-empty data dir without --force', async () => {
    const archive = await makeArchive();
    const target = join(dir, 'data');
    mkdirSync(target);
    writeFileSync(join(target, 'aepbase.db'), 'precious live data');

    expect(await restoreCmd({ from: archive, dataDir: target }, dbAlwaysOk)).toBe(1);
    expect(readFileSync(join(target, 'aepbase.db'), 'utf8')).toBe('precious live data');
    expect(logged.join('\n')).toContain('--force');
  });

  test('--force renames the old data dir aside instead of deleting it', async () => {
    const archive = await makeArchive();
    const target = join(dir, 'data');
    mkdirSync(target);
    writeFileSync(join(target, 'aepbase.db'), 'precious live data');

    expect(await restoreCmd({ from: archive, dataDir: target, force: true, stamp: '20260101-000000' }, dbAlwaysOk),
    ).toBe(0);

    expect(readFileSync(join(target, 'aepbase.db'), 'utf8')).toBe('snapshot of aepbase.db');
    const kept = `${target}.pre-restore-20260101-000000`;
    expect(readFileSync(join(kept, 'aepbase.db'), 'utf8')).toBe('precious live data');
  });

  test('--verify checks the archive without touching the data dir', async () => {
    const archive = await makeArchive();
    const target = join(dir, 'data');
    mkdirSync(target);
    writeFileSync(join(target, 'aepbase.db'), 'precious live data');

    expect(await restoreCmd({ from: archive, dataDir: target, verify: true }, dbAlwaysOk)).toBe(0);

    expect(readFileSync(join(target, 'aepbase.db'), 'utf8')).toBe('precious live data');
    expect(logged.join('\n')).toContain('intact and restorable');
  });

  test('refuses a corrupted archive and leaves the data dir alone', async () => {
    const source = join(dir, 'source');
    seedDataDir(source);
    const staged = join(dir, 'staged');
    mkdirSync(staged);
    const archive = join(dir, 'backup.tar.gz');
    expect(await backupCmd({ dataDir: source, out: archive }, fakeSnapshot)).toBe(0);

    // Rebuild the tarball with one file's bytes altered, manifest untouched.
    expect(spawnSync('tar', ['-xzf', archive, '-C', staged]).status).toBe(0);
    writeFileSync(join(staged, 'files', 'gift-cards', 'front_image'), 'tampered!');
    rmSync(archive);
    expect(
      spawnSync('tar', ['-czf', archive, '-C', staged, ...readdirSync(staged)]).status,
    ).toBe(0);

    const target = join(dir, 'data');
    expect(await restoreCmd({ from: archive, dataDir: target }, dbAlwaysOk)).toBe(1);
    expect(existsSync(target)).toBe(false);
    expect(logged.join('\n')).toContain('does not match its manifest');
  });

  test('refuses when the archive names a different master key', async () => {
    process.env.HOMESTEAD_MASTER_KEY = KEY_A;
    const archive = await makeArchive();
    process.env.HOMESTEAD_MASTER_KEY = KEY_B;

    const target = join(dir, 'data');
    expect(await restoreCmd({ from: archive, dataDir: target }, dbAlwaysOk)).toBe(1);
    expect(existsSync(target)).toBe(false);
    expect(logged.join('\n')).toContain('was written under master key');
  });

  test('--allow-key-mismatch overrides the key check', async () => {
    process.env.HOMESTEAD_MASTER_KEY = KEY_A;
    const archive = await makeArchive();
    process.env.HOMESTEAD_MASTER_KEY = KEY_B;

    const target = join(dir, 'data');
    expect(await restoreCmd({ from: archive, dataDir: target, allowKeyMismatch: true }, dbAlwaysOk),
    ).toBe(0);
    expect(existsSync(join(target, 'aepbase.db'))).toBe(true);
  });

  test('stops when a database fails its integrity check', async () => {
    const archive = await makeArchive();
    const target = join(dir, 'data');

    expect(await restoreCmd({ from: archive, dataDir: target }, () => false)).toBe(1);
    expect(existsSync(target)).toBe(false);
  });

  test('leaves no staging directory behind', async () => {
    const archive = await makeArchive();
    const target = join(dir, 'data');
    expect(await restoreCmd({ from: archive, dataDir: target }, dbAlwaysOk)).toBe(0);
    expect(readdirSync(dir).filter((n) => n.startsWith('.homestead-restore-'))).toEqual([]);
  });
});

describe('encrypted archives', () => {
  test('an archive encrypted to a backup key is opaque on disk', async () => {
    const { recipient } = generateBackupKeypair();
    const archive = await makeArchive('backup.tar.gz.enc', recipient);

    const bytes = readFileSync(archive);
    expect(hasArchiveMagic(bytes)).toBe(true);
    // Nothing recognisable from the data dir survives in the ciphertext.
    expect(bytes.includes(Buffer.from('blob bytes'))).toBe(false);
    expect(bytes.includes(Buffer.from('gift-cards'))).toBe(false);
    expect(bytes.includes(Buffer.from(MANIFEST_NAME))).toBe(false);
    // The header identifies the key without revealing anything about contents.
    expect(bytes.toString('latin1')).toContain(recipient);
  });

  test('round-trips through restore with the matching identity', async () => {
    const { identity, recipient } = generateBackupKeypair();
    const archive = await makeArchive('backup.tar.gz.enc', recipient);
    const target = join(dir, 'data');

    expect(await restoreCmd({ from: archive, dataDir: target, identity }, dbAlwaysOk)).toBe(0);

    expect(readFileSync(join(target, 'aepbase.db'), 'utf8')).toBe('snapshot of aepbase.db');
    expect(readFileSync(join(target, 'files', 'gift-cards', 'front_image'), 'utf8')).toBe(
      'blob bytes',
    );
    expect(existsSync(join(target, MANIFEST_NAME))).toBe(false);
  });

  test('--verify proves an encrypted archive can actually be opened', async () => {
    const { identity, recipient } = generateBackupKeypair();
    const archive = await makeArchive('backup.tar.gz.enc', recipient);
    const target = join(dir, 'data');

    expect(
      await restoreCmd({ from: archive, dataDir: target, verify: true, identity }, dbAlwaysOk),
    ).toBe(0);

    expect(logged.join('\n')).toContain('intact and restorable');
    expect(existsSync(target)).toBe(false);
  });

  test('refuses without an identity, naming the key it needs', async () => {
    const { recipient } = generateBackupKeypair();
    const archive = await makeArchive('backup.tar.gz.enc', recipient);
    const target = join(dir, 'data');

    expect(await restoreCmd({ from: archive, dataDir: target }, dbAlwaysOk)).toBe(1);

    const text = logged.join('\n');
    expect(text).toContain(recipientFingerprint(recipient));
    expect(text).toContain('--identity');
    expect(existsSync(target)).toBe(false);
  });

  test('refuses the wrong identity, naming both keys', async () => {
    const { recipient } = generateBackupKeypair();
    const stranger = generateBackupKeypair();
    const archive = await makeArchive('backup.tar.gz.enc', recipient);
    const target = join(dir, 'data');

    expect(
      await restoreCmd({ from: archive, dataDir: target, identity: stranger.identity }, dbAlwaysOk),
    ).toBe(1);

    const text = logged.join('\n');
    expect(text).toContain(recipientFingerprint(recipient));
    expect(text).toContain(recipientFingerprint(stranger.recipient));
    expect(existsSync(target)).toBe(false);
  });

  test('accepts an identity given as a file path', async () => {
    const { identity, recipient } = generateBackupKeypair();
    const archive = await makeArchive('backup.tar.gz.enc', recipient);
    const keyFile = join(dir, 'backup.key');
    writeFileSync(keyFile, `${identity}\n`);
    const target = join(dir, 'data');

    expect(
      await restoreCmd({ from: archive, dataDir: target, identity: keyFile }, dbAlwaysOk),
    ).toBe(0);
    expect(existsSync(join(target, 'aepbase.db'))).toBe(true);
  });

  test('reads the identity from the environment', async () => {
    const { identity, recipient } = generateBackupKeypair();
    const archive = await makeArchive('backup.tar.gz.enc', recipient);
    process.env.HOMESTEAD_BACKUP_IDENTITY = identity;
    const target = join(dir, 'data');

    expect(await restoreCmd({ from: archive, dataDir: target }, dbAlwaysOk)).toBe(0);
    expect(existsSync(join(target, 'aepbase.db'))).toBe(true);
  });

  test('restores a renamed archive — encryption is detected by content', async () => {
    const { identity, recipient } = generateBackupKeypair();
    const archive = await makeArchive('not-obviously-encrypted.bin', recipient);
    const target = join(dir, 'data');

    expect(await restoreCmd({ from: archive, dataDir: target, identity }, dbAlwaysOk)).toBe(0);
    expect(existsSync(join(target, 'aepbase.db'))).toBe(true);
  });

  test('refuses a tampered archive and leaves the data dir alone', async () => {
    const { identity, recipient } = generateBackupKeypair();
    const archive = await makeArchive('backup.tar.gz.enc', recipient);
    const bytes = readFileSync(archive);
    bytes[bytes.length - 40] ^= 0xff;
    writeFileSync(archive, bytes);
    const target = join(dir, 'data');

    expect(await restoreCmd({ from: archive, dataDir: target, identity }, dbAlwaysOk)).toBe(1);
    expect(logged.join('\n')).toMatch(/could not be decrypted|altered/);
    expect(existsSync(target)).toBe(false);
  });

  test('refuses a truncated archive rather than restoring what survived', async () => {
    const { identity, recipient } = generateBackupKeypair();
    const archive = await makeArchive('backup.tar.gz.enc', recipient);
    const bytes = readFileSync(archive);
    writeFileSync(archive, bytes.subarray(0, bytes.length - 60));
    const target = join(dir, 'data');

    expect(await restoreCmd({ from: archive, dataDir: target, identity }, dbAlwaysOk)).toBe(1);
    expect(existsSync(target)).toBe(false);
  });

  test('an unencrypted archive still restores with no identity in sight', async () => {
    const archive = await makeArchive();
    const target = join(dir, 'data');
    expect(await restoreCmd({ from: archive, dataDir: target }, dbAlwaysOk)).toBe(0);
    expect(existsSync(join(target, 'aepbase.db'))).toBe(true);
  });
});
