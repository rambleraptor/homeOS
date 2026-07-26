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

/**
 * The (record, field) to replace, plus the identity of the embedding model that
 * produced the vectors. Vectors are not comparable across models — a vector from
 * one model is meaningless in another's space — so the model is part of the
 * stored key: a `replace` touches only *this* model's vectors for the field,
 * letting a second model's vectors coexist (the basis for a zero-downtime model
 * swap). The identity is a fully-qualified `provider:model` string, e.g.
 * `openai:text-embedding-3-small` (see `getEmbeddingModelId`).
 */
export interface ReplaceScope extends FieldScope {
  model: string;
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
  /**
   * Identity of the model that produced {@link vector}. The store compares only
   * against vectors stored under the same model, so a query is never scored
   * against another model's incomparable vectors. A `provider:model` string,
   * matching what `replace` stored (see {@link ReplaceScope.model}).
   */
  model: string;
  /** Maximum hits to return. */
  limit: number;
  /** Restrict to these resource singulars. Omit to search all. */
  resources?: string[];
}

export interface VectorStore {
  /**
   * Replace the vectors for one (record, field) **under `scope.model`** with
   * `chunks`. Re-indexing a file is a full replace for that model, so a shrunk
   * document leaves no stale chunks behind — but vectors stored under a
   * *different* model are untouched, so two models' vectors coexist until one is
   * purged.
   */
  replace(scope: ReplaceScope, chunks: VectorChunk[]): Promise<void>;
  /**
   * Delete vectors for a record, or one field of it — across **every** model.
   * A deleted record (or emptied field) has no content under any model, so all
   * of its vectors go.
   */
  purge(scope: PurgeScope): Promise<void>;
  /** Nearest-neighbor search by cosine similarity. */
  search(query: VectorSearchQuery): Promise<VectorHit[]>;
}
