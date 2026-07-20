/**
 * Vector store contract for semantic search over file fields.
 *
 * The store is a derived index, not aepbase data — vectors are
 * high-dimensional float arrays that don't belong in the resource wire format.
 * Core defines the interface; the server injects a concrete SQLite-backed
 * implementation at boot via {@link setVectorStore} (same dependency-inversion
 * pattern as the AI config), because core can't import the server's SQLite seam.
 *
 * Everything is keyed by the `(resource, record, field)` triple: the
 * (record, field) pair — not the record — is the unit of indexing, so a resource
 * with several embedded file fields keeps their chunks separate.
 */

/** Identifies one embedded file field on one record. */
export interface FieldScope {
  /** Resource singular, e.g. `document`. */
  resource: string;
  /** Record id. */
  record: string;
  /** File field name, e.g. `file`. */
  field: string;
}

/** Targets vectors to delete: a whole record, or one field of it. */
export interface PurgeScope {
  resource: string;
  record: string;
  /** Omit to purge every field of the record. */
  field?: string;
}

/** One embedded chunk. `vector` may be unnormalized — the store normalizes. */
export interface VectorChunk {
  /** Chunk index within its (record, field). */
  chunk: number;
  /** The chunk's text, returned verbatim as the search passage. */
  text: string;
  /** The embedding for {@link text}. */
  vector: number[];
}

/** A search hit: the matched passage plus its citation. */
export interface VectorHit extends FieldScope {
  chunk: number;
  text: string;
  /** Cosine similarity to the query, in [-1, 1]; higher is closer. */
  score: number;
}

export interface VectorSearchQuery {
  /** Query embedding (any magnitude — normalized internally). */
  vector: number[];
  /** Maximum hits to return. */
  limit: number;
  /** Restrict to these resource singulars. Omit to search all. */
  resources?: string[];
}

export interface VectorStore {
  /**
   * Replace all vectors for one (record, field) with `chunks`. Re-indexing a
   * file is a full replace, so a shrunk document leaves no stale chunks behind.
   */
  replace(scope: FieldScope, chunks: VectorChunk[]): Promise<void>;
  /** Delete vectors for a record, or one field of it. */
  purge(scope: PurgeScope): Promise<void>;
  /** Nearest-neighbor search by cosine similarity. */
  search(query: VectorSearchQuery): Promise<VectorHit[]>;
}
