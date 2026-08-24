import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  generateBackupKeyCmd,
  resolveIdentity,
  resolveRecipient,
  showBackupKeyCmd,
} from './backup-key.ts';
import { generateBackupKeypair, parseIdentity, parseRecipient } from './archive-crypto.ts';

let dir: string;
const savedEnv = { ...process.env };
let logged: string[];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hs-backupkey-'));
  delete process.env.HOMESTEAD_BACKUP_RECIPIENT;
  delete process.env.HOMESTEAD_BACKUP_IDENTITY;
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

describe('generateBackupKeyCmd', () => {
  test('writes only the public recipient, printing the secret', () => {
    const recipientFile = join(dir, 'backup-recipient.pub');

    expect(generateBackupKeyCmd({ recipientFile })).toBe(0);

    const recipient = readFileSync(recipientFile, 'utf8').trim();
    expect(() => parseRecipient(recipient)).not.toThrow();

    const output = logged.join('\n');
    expect(output).toContain(recipient);
    // The identity is printed for the operator to stash, and — the whole point
    // of the asymmetric design — is nowhere on disk.
    const identity = output.match(/hsbk1sk_[A-Za-z0-9_-]+/)?.[0];
    expect(identity).toBeDefined();
    expect(() => parseIdentity(identity!)).not.toThrow();
    expect(existsSync(join(dir, 'backup.key'))).toBe(false);
  });

  test('says loudly that the identity cannot be recovered', () => {
    expect(generateBackupKeyCmd({ recipientFile: join(dir, 'r.pub') })).toBe(0);
    const output = logged.join('\n');
    expect(output).toContain('STORE THIS SOMEWHERE OFF THIS MACHINE');
    expect(output).toContain('permanently');
  });

  test('--out also saves the identity at 0600, warning about the trade', () => {
    const out = join(dir, 'backup.key');
    expect(generateBackupKeyCmd({ recipientFile: join(dir, 'r.pub'), out })).toBe(0);

    expect(statSync(out).mode & 0o777).toBe(0o600);
    expect(() => parseIdentity(readFileSync(out, 'utf8').trim())).not.toThrow();
    expect(logged.join('\n')).toContain('a thief who');
  });

  test('refuses to replace an existing recipient without --force', () => {
    const recipientFile = join(dir, 'r.pub');
    expect(generateBackupKeyCmd({ recipientFile })).toBe(0);
    const first = readFileSync(recipientFile, 'utf8');

    expect(generateBackupKeyCmd({ recipientFile })).toBe(1);
    expect(readFileSync(recipientFile, 'utf8')).toBe(first);
    expect(logged.join('\n')).toContain('could only be restored with its identity');

    expect(generateBackupKeyCmd({ recipientFile, force: true })).toBe(0);
    expect(readFileSync(recipientFile, 'utf8')).not.toBe(first);
  });
});

describe('resolveRecipient', () => {
  test('prefers an explicit key over a file over the environment', () => {
    const { recipient: flagKey } = generateBackupKeypair();
    const { recipient: fileKey } = generateBackupKeypair();
    const file = join(dir, 'r.pub');
    writeFileSync(file, `${fileKey}\n`);
    process.env.HOMESTEAD_BACKUP_RECIPIENT = generateBackupKeypair().recipient;

    expect(resolveRecipient({ recipient: flagKey, recipientFile: file })).toEqual({
      source: 'flag',
      value: flagKey,
    });
    expect(resolveRecipient({ recipientFile: file }).value).toBe(fileKey);
    expect(resolveRecipient({}).source).toBe('env');
  });

  test('reports none when nothing is configured', () => {
    // The default path is a real home dir, so only assert the shape we control.
    expect(resolveRecipient({ recipientFile: join(dir, 'missing.pub') })).toEqual({
      source: 'file',
      path: join(dir, 'missing.pub'),
      value: undefined,
    });
  });
});

describe('resolveIdentity', () => {
  test('accepts the key inline', () => {
    const { identity } = generateBackupKeypair();
    expect(resolveIdentity({ identity }).value).toBe(identity);
  });

  test('accepts a path to the key', () => {
    const { identity } = generateBackupKeypair();
    const file = join(dir, 'backup.key');
    writeFileSync(file, `${identity}\n`);
    expect(resolveIdentity({ identity: file }).value).toBe(identity);
  });

  test('reads the environment, inline or by path', () => {
    const { identity } = generateBackupKeypair();
    process.env.HOMESTEAD_BACKUP_IDENTITY = identity;
    expect(resolveIdentity({}).value).toBe(identity);

    const file = join(dir, 'backup.key');
    writeFileSync(file, `${identity}\n`);
    process.env.HOMESTEAD_BACKUP_IDENTITY = file;
    expect(resolveIdentity({}).value).toBe(identity);
  });

  test('reports the path it looked at when the file is missing', () => {
    const missing = join(dir, 'gone.key');
    expect(resolveIdentity({ identity: missing })).toEqual({ source: 'flag', path: missing });
  });
});

describe('showBackupKeyCmd', () => {
  test('prints the configured recipient', () => {
    const file = join(dir, 'r.pub');
    const { recipient } = generateBackupKeypair();
    writeFileSync(file, `${recipient}\n`);

    const written: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      written.push(String(chunk));
      return true;
    });

    expect(showBackupKeyCmd({ recipientFile: file })).toBe(0);
    expect(written.join('').trim()).toBe(recipient);
  });

  test('explains where to look when no recipient is configured', () => {
    expect(showBackupKeyCmd({ recipientFile: join(dir, 'missing.pub') })).toBe(1);
    expect(logged.join('\n')).toContain('backup-key generate');
  });

  test('--identity says the secret is meant to live elsewhere', () => {
    // Point at a path we control, so the result never depends on whether the
    // developer running the suite happens to have an identity in their home.
    process.env.HOMESTEAD_BACKUP_IDENTITY = join(dir, 'not-here.key');
    expect(showBackupKeyCmd({ identity: true })).toBe(1);
    expect(logged.join('\n')).toContain('kept off this machine');
  });
});
