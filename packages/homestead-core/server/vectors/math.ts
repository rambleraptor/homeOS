/**
 * Vector math for the brute-force cosine store. Pure and dependency-free so it's
 * unit-testable and shared by the server's SQLite store (which normalizes on
 * write and scores by dot product on read).
 */

/**
 * L2-normalize a vector into a Float32Array so cosine similarity reduces to a
 * dot product. An all-zero vector normalizes to all-zero (dot product 0), which
 * is the correct "no similarity" answer rather than a divide-by-zero.
 */
export function normalize(vec: number[] | Float32Array): Float32Array {
  const out = new Float32Array(vec.length);
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return out;
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm;
  return out;
}

/** Dot product of two equal-length vectors. On normalized inputs this is cosine. */
export function dot(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/** Cosine similarity of two raw vectors, in [-1, 1]. Convenience for callers/tests. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`cosineSimilarity: length mismatch ${a.length} vs ${b.length}`);
  }
  return dot(normalize(a), normalize(b));
}
