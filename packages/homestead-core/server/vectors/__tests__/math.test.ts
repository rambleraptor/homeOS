import { describe, expect, it } from 'vitest';
import { cosineSimilarity, dot, normalize } from '../math';

// Vectors are stored as Float32, so equality holds to ~6-7 significant digits,
// not full double precision — assertions reflect that.
describe('normalize', () => {
  it('scales a vector to unit length', () => {
    const n = normalize([3, 4]);
    expect(Math.hypot(n[0], n[1])).toBeCloseTo(1, 5);
    expect(n[0]).toBeCloseTo(0.6, 5);
    expect(n[1]).toBeCloseTo(0.8, 5);
  });

  it('maps an all-zero vector to all-zero (no divide-by-zero)', () => {
    expect(Array.from(normalize([0, 0, 0]))).toEqual([0, 0, 0]);
  });
});

describe('cosineSimilarity', () => {
  it('is 1 for identical, 0 for orthogonal, -1 for opposite', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
  });

  it('is magnitude-invariant', () => {
    expect(cosineSimilarity([2, 0], [5, 0])).toBeCloseTo(1, 5);
  });

  it('throws on a length mismatch', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(/length mismatch/);
  });
});

describe('dot', () => {
  it('sums the elementwise product', () => {
    expect(dot(new Float32Array([1, 2, 3]), new Float32Array([4, 5, 6]))).toBeCloseTo(32, 5);
  });
});
