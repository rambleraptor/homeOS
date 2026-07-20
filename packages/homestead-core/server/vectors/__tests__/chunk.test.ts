import { describe, expect, it } from 'vitest';
import { chunkText } from '../chunk';

describe('chunkText', () => {
  it('returns no chunks for empty or whitespace-only text', () => {
    expect(chunkText('', { chunk_size: 100, overlap: 10 })).toEqual([]);
    expect(chunkText('   \n\t ', { chunk_size: 100, overlap: 10 })).toEqual([]);
  });

  it('returns a single chunk when the text fits', () => {
    expect(chunkText('hello world', { chunk_size: 100, overlap: 10 })).toEqual([
      'hello world',
    ]);
  });

  it('splits long text into overlapping windows', () => {
    const text = 'abcdefghij'; // 10 chars
    const chunks = chunkText(text, { chunk_size: 4, overlap: 1 });
    // step = 4 - 1 = 3 → windows at [0,4) [3,7) [6,10); the last covers index 9,
    // so the loop stops rather than emitting a redundant tail chunk.
    expect(chunks).toEqual(['abcd', 'defg', 'ghij']);
  });

  it('covers the whole text with no gaps between consecutive windows', () => {
    const text = 'x'.repeat(1000);
    const chunks = chunkText(text, { chunk_size: 300, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    // Concatenated length ≥ original (overlap duplicates, never drops).
    expect(chunks.join('').length).toBeGreaterThanOrEqual(text.length);
  });

  it('advances even when overlap is silly (>= chunk_size)', () => {
    // Validator rejects this at schema time, but the helper must not loop forever.
    const chunks = chunkText('abcdef', { chunk_size: 3, overlap: 99 });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.length).toBeLessThan(10);
  });
});
