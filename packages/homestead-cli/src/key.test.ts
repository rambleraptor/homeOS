import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  generateKeyCmd,
  keyPermsAreLocked,
  resolveKeyLocation,
  showKeyCmd,
} from './key.ts';

let dir: string;
const savedEnv = { ...process.env };

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hs-keytest-'));
  delete process.env.HOMESTEAD_MASTER_KEY;
  delete process.env.HOMESTEAD_MASTER_KEY_FILE;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  process.env = { ...savedEnv };
  vi.restoreAllMocks();
});

describe('generateKeyCmd', () => {
  test('writes a 32-byte base64 key at mode 0600', () => {
    const path = join(dir, 'master.key');
    expect(generateKeyCmd({ file: path })).toBe(0);

    const key = Buffer.from(readFileSync(path, 'utf8').trim(), 'base64');
    expect(key.length).toBe(32);
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  test('refuses to overwrite without --force', () => {
    const path = join(dir, 'master.key');
    expect(generateKeyCmd({ file: path })).toBe(0);
    const first = readFileSync(path, 'utf8');

    expect(generateKeyCmd({ file: path })).toBe(1);
    expect(readFileSync(path, 'utf8')).toBe(first); // unchanged

    expect(generateKeyCmd({ file: path, force: true })).toBe(0);
    expect(readFileSync(path, 'utf8')).not.toBe(first); // rotated
  });
});

describe('resolveKeyLocation', () => {
  test('prefers the inline env var', () => {
    process.env.HOMESTEAD_MASTER_KEY = 'aGVsbG8=';
    expect(resolveKeyLocation()).toMatchObject({ source: 'env', value: 'aGVsbG8=' });
  });

  test('reads an explicit key file', () => {
    const path = join(dir, 'k');
    writeFileSync(path, 'Zm9v\n');
    process.env.HOMESTEAD_MASTER_KEY_FILE = path;
    expect(resolveKeyLocation()).toMatchObject({ source: 'file', path, value: 'Zm9v' });
  });
});

describe('showKeyCmd', () => {
  test('prints from an explicit --file', () => {
    const path = join(dir, 'k');
    writeFileSync(path, 'YmFy\n');
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    expect(showKeyCmd({ file: path })).toBe(0);
    expect(out).toHaveBeenCalledWith('YmFy\n');
  });

  test('errors when nothing is configured', () => {
    expect(showKeyCmd({ file: join(dir, 'missing') })).toBe(1);
  });
});

describe('keyPermsAreLocked', () => {
  test('true only when group/other have no access', () => {
    const locked = join(dir, 'locked');
    writeFileSync(locked, 'x', { mode: 0o600 });
    const open = join(dir, 'open');
    writeFileSync(open, 'x', { mode: 0o644 });
    expect(keyPermsAreLocked(locked)).toBe(true);
    expect(keyPermsAreLocked(open)).toBe(false);
  });
});
