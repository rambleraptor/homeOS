import { describe, expect, test } from 'vitest';
import { sha256Hex } from '../hash';

describe('sha256Hex', () => {
  test('matches known SHA-256 vectors', () => {
    // Standard vectors: the empty input and "abc".
    expect(sha256Hex(new Uint8Array())).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  test('is stable and lowercase-hex', () => {
    const bytes = new TextEncoder().encode('receipt.pdf bytes');
    const hash = sha256Hex(bytes);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex(bytes)).toBe(hash);
  });

  test('differs for different content', () => {
    expect(sha256Hex(new TextEncoder().encode('a'))).not.toBe(
      sha256Hex(new TextEncoder().encode('b')),
    );
  });
});
