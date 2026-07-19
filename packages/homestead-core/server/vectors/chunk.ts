/**
 * Split extracted text into overlapping chunks for embedding. Character-based
 * and deterministic (so tests are stable); overlap keeps a passage that
 * straddles a boundary retrievable from either side.
 */

export interface ChunkOptions {
  /** Approximate characters per chunk. */
  chunk_size: number;
  /** Characters of overlap between consecutive chunks. */
  overlap: number;
}

/**
 * Chunk `text` into pieces of about `chunk_size` characters that overlap by
 * `overlap`. Whitespace is normalized and each piece trimmed; empty input (or
 * whitespace-only) yields no chunks. `overlap` is clamped below `chunk_size` so
 * the window always advances (the schema validator already rejects
 * `overlap >= chunk_size`, but this stays safe if called directly).
 */
export function chunkText(text: string, { chunk_size, overlap }: ChunkOptions): string[] {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];
  if (clean.length <= chunk_size) return [clean];

  const step = Math.max(1, chunk_size - Math.max(0, Math.min(overlap, chunk_size - 1)));
  const chunks: string[] = [];
  for (let start = 0; start < clean.length; start += step) {
    const piece = clean.slice(start, start + chunk_size).trim();
    if (piece) chunks.push(piece);
    if (start + chunk_size >= clean.length) break;
  }
  return chunks;
}
