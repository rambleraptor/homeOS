import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DecryptError,
  FILE_MARKER_ENCRYPTED,
  FILE_MARKER_PLAINTEXT,
  MissingMasterKeyError,
  TEXT_PREFIX,
  __resetMasterKeyCacheForTests,
  decryptBytes,
  decryptText,
  encryptBytes,
  encryptText,
  encryptionEnabled,
  isEncryptedContainer,
  isEncryptedText,
} from '../../src/engine/crypto';

const KEY_A = randomBytes(32).toString('base64');
const KEY_B = randomBytes(32).toString('base64');
const OWNER = 'users/alice';

function useKey(base64: string | null): void {
  if (base64 === null) delete process.env.HOMESTEAD_MASTER_KEY;
  else process.env.HOMESTEAD_MASTER_KEY = base64;
  delete process.env.HOMESTEAD_MASTER_KEY_FILE;
  __resetMasterKeyCacheForTests();
}

afterEach(() => {
  useKey(null);
});

describe('markers', () => {
  test('are the human-readable values wired into the DB', () => {
    expect(FILE_MARKER_PLAINTEXT).toBe('1');
    expect(FILE_MARKER_ENCRYPTED).toBe('enc:v1');
    expect(TEXT_PREFIX).toBe('enc:v1:');
  });
});

describe('encryptionEnabled', () => {
  test('reflects whether a key is configured', () => {
    useKey(null);
    expect(encryptionEnabled()).toBe(false);
    useKey(KEY_A);
    expect(encryptionEnabled()).toBe(true);
  });

  test('reads the key from HOMESTEAD_MASTER_KEY_FILE', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hs-key-'));
    const keyPath = join(dir, 'master.key');
    writeFileSync(keyPath, `${KEY_A}\n`); // trailing newline is trimmed
    try {
      delete process.env.HOMESTEAD_MASTER_KEY;
      process.env.HOMESTEAD_MASTER_KEY_FILE = keyPath;
      __resetMasterKeyCacheForTests();
      expect(encryptionEnabled()).toBe(true);
      const c = encryptText('from-file', OWNER);
      expect(decryptText(c, OWNER)).toBe('from-file');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('rejects a wrong-length key', () => {
    process.env.HOMESTEAD_MASTER_KEY = Buffer.from('too-short').toString('base64');
    delete process.env.HOMESTEAD_MASTER_KEY_FILE;
    __resetMasterKeyCacheForTests();
    expect(() => encryptionEnabled()).toThrow(MissingMasterKeyError);
  });
});

describe('bytes round-trip', () => {
  beforeEach(() => useKey(KEY_A));

  test('encrypt then decrypt returns the original', () => {
    const plaintext = randomBytes(1024);
    const container = encryptBytes(plaintext, OWNER);
    expect(isEncryptedContainer(container)).toBe(true);
    expect(container.equals(plaintext)).toBe(false);
    expect(decryptBytes(container, OWNER).equals(plaintext)).toBe(true);
  });

  test('empty input round-trips', () => {
    const container = encryptBytes(Buffer.alloc(0), OWNER);
    expect(decryptBytes(container, OWNER).length).toBe(0);
  });

  test('two encryptions of the same input differ (fresh DEK + nonce)', () => {
    const pt = Buffer.from('same');
    expect(encryptBytes(pt, OWNER).equals(encryptBytes(pt, OWNER))).toBe(false);
  });
});

describe('text round-trip', () => {
  beforeEach(() => useKey(KEY_A));

  test('encrypt produces the enc:v1: prefix and decrypts back', () => {
    const value = encryptText('extracted receipt text', OWNER);
    expect(isEncryptedText(value)).toBe(true);
    expect(value.startsWith(TEXT_PREFIX)).toBe(true);
    expect(decryptText(value, OWNER)).toBe('extracted receipt text');
  });

  test('legacy plaintext (no prefix) passes through unchanged', () => {
    expect(decryptText('plain legacy text', OWNER)).toBe('plain legacy text');
    expect(isEncryptedText('plain legacy text')).toBe(false);
  });
});

describe('fails closed', () => {
  test('encrypt without a key throws MissingMasterKeyError', () => {
    useKey(null);
    expect(() => encryptBytes(Buffer.from('x'), OWNER)).toThrow(MissingMasterKeyError);
    expect(() => encryptText('x', OWNER)).toThrow(MissingMasterKeyError);
  });

  test('tampered ciphertext throws DecryptError', () => {
    useKey(KEY_A);
    const container = encryptBytes(Buffer.from('secret'), OWNER);
    container[container.length - 1] ^= 0xff; // flip a byte in the ciphertext/tag
    expect(() => decryptBytes(container, OWNER)).toThrow(DecryptError);
  });

  test('wrong owner cannot unwrap the DEK', () => {
    useKey(KEY_A);
    const container = encryptBytes(Buffer.from('secret'), OWNER);
    expect(() => decryptBytes(container, 'users/mallory')).toThrow(DecryptError);
  });

  test('wrong master key cannot decrypt', () => {
    useKey(KEY_A);
    const container = encryptBytes(Buffer.from('secret'), OWNER);
    useKey(KEY_B);
    expect(() => decryptBytes(container, OWNER)).toThrow(DecryptError);
  });

  test('decrypting non-container bytes throws DecryptError', () => {
    useKey(KEY_A);
    expect(() => decryptBytes(Buffer.from('not a container'), OWNER)).toThrow(DecryptError);
  });

  test('decrypting encrypted text without a key throws', () => {
    useKey(KEY_A);
    const value = encryptText('secret', OWNER);
    useKey(null);
    expect(() => decryptText(value, OWNER)).toThrow(MissingMasterKeyError);
  });
});
