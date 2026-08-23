import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  hashEntries,
  listFiles,
  MANIFEST_FORMAT,
  MANIFEST_NAME,
  readManifest,
  sha256File,
  verifyExtracted,
  writeManifest,
  type BackupManifest,
} from './manifest.ts';
import { keyFingerprint } from './key.ts';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hs-manifest-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function seed(): void {
  writeFileSync(join(dir, 'aepbase.db'), 'db bytes');
  mkdirSync(join(dir, 'files', 'gift-cards'), { recursive: true });
  writeFileSync(join(dir, 'files', 'gift-cards', 'front_image'), 'blob');
}

function manifestFor(entries: string[]): BackupManifest {
  return {
    format: MANIFEST_FORMAT,
    created_at: '2026-01-01T00:00:00.000Z',
    homestead_version: '0.2.0',
    data_dir_name: 'data',
    encryption: { enabled: false },
    databases: ['aepbase.db'],
    files: hashEntries(dir, entries),
  };
}

describe('listFiles', () => {
  test('walks directories and returns sorted archive-relative paths', () => {
    seed();
    expect(listFiles(dir, ['aepbase.db', 'files'])).toEqual([
      'aepbase.db',
      'files/gift-cards/front_image',
    ]);
  });

  test('skips symlinks, which tar stores as links rather than bytes', () => {
    seed();
    symlinkSync(join(dir, 'aepbase.db'), join(dir, 'alias.db'));
    expect(listFiles(dir, ['alias.db'])).toEqual([]);
  });

  test('ignores an entry that does not exist', () => {
    expect(listFiles(dir, ['gone'])).toEqual([]);
  });
});

describe('hashEntries', () => {
  test('records size and digest per file', () => {
    seed();
    const files = hashEntries(dir, ['aepbase.db']);
    expect(files).toEqual([
      { path: 'aepbase.db', bytes: 8, sha256: sha256File(join(dir, 'aepbase.db')) },
    ]);
  });
});

describe('readManifest', () => {
  test('round-trips a written manifest', () => {
    seed();
    const path = join(dir, MANIFEST_NAME);
    const manifest = manifestFor(['aepbase.db', 'files']);
    writeManifest(path, manifest);
    expect(readManifest(path)).toEqual(manifest);
  });

  test('rejects a newer format than this release understands', () => {
    const path = join(dir, MANIFEST_NAME);
    writeFileSync(path, JSON.stringify({ format: MANIFEST_FORMAT + 1, files: [] }));
    expect(readManifest(path)).toEqual({
      error: expect.stringContaining('upgrade homestead') as unknown as string,
    });
  });

  test('rejects unreadable or incomplete JSON', () => {
    const path = join(dir, MANIFEST_NAME);
    writeFileSync(path, '{not json');
    expect('error' in readManifest(path)).toBe(true);
    writeFileSync(path, JSON.stringify({ created_at: 'x' }));
    expect('error' in readManifest(path)).toBe(true);
  });
});

describe('verifyExtracted', () => {
  test('passes when every file matches', () => {
    seed();
    const manifest = manifestFor(['aepbase.db', 'files']);
    expect(verifyExtracted(dir, manifest)).toEqual({ problems: [], extra: [] });
  });

  test('flags a file whose contents changed', () => {
    seed();
    const manifest = manifestFor(['aepbase.db', 'files']);
    writeFileSync(join(dir, 'aepbase.db'), 'db bytez'); // same length, different bytes
    expect(verifyExtracted(dir, manifest).problems).toEqual([
      'aepbase.db: contents do not match the recorded checksum',
    ]);
  });

  test('flags a truncated file by size before hashing', () => {
    seed();
    const manifest = manifestFor(['aepbase.db', 'files']);
    writeFileSync(join(dir, 'aepbase.db'), 'db');
    expect(verifyExtracted(dir, manifest).problems).toEqual([
      'aepbase.db: expected 8 bytes, found 2',
    ]);
  });

  test('flags a file the archive lost', () => {
    seed();
    const manifest = manifestFor(['aepbase.db', 'files']);
    rmSync(join(dir, 'files', 'gift-cards', 'front_image'));
    expect(verifyExtracted(dir, manifest).problems).toEqual([
      'files/gift-cards/front_image: listed in the manifest but missing from the archive',
    ]);
  });

  test('reports unlisted files separately from corruption', () => {
    seed();
    const manifest = manifestFor(['aepbase.db']);
    const result = verifyExtracted(dir, manifest);
    expect(result.problems).toEqual([]);
    expect(result.extra).toEqual(['files/gift-cards/front_image']);
  });
});

describe('keyFingerprint', () => {
  const key = Buffer.alloc(32, 3).toString('base64');

  test('is stable for the same key and differs across keys', () => {
    expect(keyFingerprint(key)).toBe(keyFingerprint(key));
    expect(keyFingerprint(key)).not.toBe(keyFingerprint(Buffer.alloc(32, 4).toString('base64')));
  });

  test('tolerates trailing whitespace from a key file', () => {
    expect(keyFingerprint(`${key}\n`)).toBe(keyFingerprint(key));
  });

  test('does not leak the key material', () => {
    const fingerprint = keyFingerprint(key);
    expect(fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(key).not.toContain(fingerprint);
  });
});
