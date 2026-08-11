/**
 * SQLite-backed {@link VectorStore}: vectors as normalized Float32 blobs in a
 * plain table, nearest-neighbor by brute-force cosine (a dot product on
 * normalized vectors) in JS. Chosen over a native ANN extension because
 * `sqlite-vec` can't load under Bun on macOS without a Homebrew SQLite, whereas
 * this is runtime-portable (Bun + Node, macOS + Linux) with zero native deps and
 * ~36ms over 50k vectors — ample for household scale. The `VectorStore` seam
 * lets a native index slot in later without touching callers.
 *
 * Lives in the server (not core) because it uses the engine's SQLite driver;
 * the server injects it into core at boot via `setVectorStore`.
 */

import { dot, normalize } from '@rambleraptor/homestead-core/server/vectors/math';
import type {
  PurgeScope,
  ReplaceScope,
  VectorChunk,
  VectorHit,
  VectorSearchQuery,
  VectorStore,
} from '@rambleraptor/homestead-core/server/vectors/types';
import { Database } from '../engine/sqlite';

/**
 * Sentinel model tag applied to rows carried over from a pre-`model` database.
 * Their producing model is unknown, so they're quarantined under a tag no live
 * query names (`provider:model` reals never start with `legacy:`): the text is
 * preserved for a cheap re-embed, but the vectors are never compared against a
 * real model's. Purge them with `DELETE ... WHERE model = LEGACY_MODEL` once the
 * re-embed backfill has run.
 */
export const LEGACY_MODEL = 'legacy:unknown';

interface VectorRow {
  resource: string;
  record: string;
  field: string;
  chunk: number | bigint;
  text: string;
  dim: number | bigint;
  vec: Uint8Array;
}

/** Normalized Float32 vector → tightly-packed bytes for a BLOB column. */
function encodeVector(vector: number[]): Uint8Array {
  return new Uint8Array(normalize(vector).buffer);
}

/**
 * BLOB bytes → Float32Array. Copies into a fresh buffer first: a driver may hand
 * back a Buffer that's a view into a pooled allocation with a non-4-aligned
 * byteOffset, and `new Float32Array(buffer, offset)` throws on misalignment.
 */
function decodeVector(bytes: Uint8Array): Float32Array {
  const copy = Uint8Array.from(bytes);
  return new Float32Array(copy.buffer, 0, copy.byteLength >> 2);
}

export interface SqliteVectorStore extends VectorStore {
  close(): void;
}

/** Create the current-shape table (with the `model` column) if it's absent. */
function createTable(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS file_vectors (
      resource TEXT NOT NULL,
      record   TEXT NOT NULL,
      field    TEXT NOT NULL,
      chunk    INTEGER NOT NULL,
      model    TEXT NOT NULL,
      text     TEXT NOT NULL,
      dim      INTEGER NOT NULL,
      vec      BLOB NOT NULL,
      PRIMARY KEY (resource, record, field, chunk, model)
    )
  `);
  db.run(
    `CREATE INDEX IF NOT EXISTS file_vectors_scope ON file_vectors (resource, record, field)`,
  );
}

/**
 * Bring an existing db up to the `model`-tagged shape. A fresh db just gets the
 * table. A pre-`model` db is migrated in place: `model` belongs to the primary
 * key, and SQLite can't add a PK column via `ALTER TABLE`, so we rebuild the
 * table and carry every legacy row over tagged {@link LEGACY_MODEL} — preserving
 * its text (for a cheap re-embed) while keeping it out of every real model's
 * search results. Idempotent: a no-op once `model` is present.
 */
function migrateSchema(db: Database): void {
  const cols = db.query(`PRAGMA table_info(file_vectors)`).all() as { name: string }[];
  const hasModelColumn = cols.some((c) => c.name === 'model');
  if (cols.length > 0 && !hasModelColumn) {
    const migrate = db.transaction(() => {
      db.run(`ALTER TABLE file_vectors RENAME TO file_vectors_legacy`);
      createTable(db);
      db.run(
        `INSERT INTO file_vectors (resource, record, field, chunk, model, text, dim, vec)
         SELECT resource, record, field, chunk, ?, text, dim, vec FROM file_vectors_legacy`,
        LEGACY_MODEL,
      );
      db.run(`DROP TABLE file_vectors_legacy`);
    });
    migrate();
    return;
  }
  createTable(db);
}

/**
 * Open (creating if needed) the vector store at `dbPath`. A separate SQLite file
 * from the engine's `aepbase.db`, so the index stays decoupled from aepbase's
 * schema management.
 */
export function createSqliteVectorStore(dbPath: string): SqliteVectorStore {
  const db = new Database(dbPath, { create: true });
  // Match the engine's durability settings (see openDb): WAL survives an
  // unclean shutdown far better than the default rollback journal, and a busy
  // timeout keeps concurrent embed writes from failing outright with SQLITE_BUSY
  // instead of waiting. No-ops for an in-memory db.
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA busy_timeout=5000');
  migrateSchema(db);

  // Field-scoped delete is now *per model*: re-embedding one field under a new
  // model must not disturb vectors another model wrote for the same field.
  const delFieldModel = `DELETE FROM file_vectors
    WHERE resource = ? AND record = ? AND field = ? AND model = ?`;

  async function replace(scope: ReplaceScope, chunks: VectorChunk[]): Promise<void> {
    const run = db.transaction(() => {
      db.run(delFieldModel, scope.resource, scope.record, scope.field, scope.model);
      const insert = db.query(
        `INSERT INTO file_vectors (resource, record, field, chunk, model, text, dim, vec)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const c of chunks) {
        insert.run(
          scope.resource,
          scope.record,
          scope.field,
          c.chunk,
          scope.model,
          c.text,
          c.vector.length,
          encodeVector(c.vector),
        );
      }
    });
    run();
  }

  async function purge(scope: PurgeScope): Promise<void> {
    // Purge spans every model: a gone record / emptied field has no content
    // under any model.
    if (scope.field !== undefined) {
      db.run(
        `DELETE FROM file_vectors WHERE resource = ? AND record = ? AND field = ?`,
        scope.resource,
        scope.record,
        scope.field,
      );
    } else {
      db.run(
        `DELETE FROM file_vectors WHERE resource = ? AND record = ?`,
        scope.resource,
        scope.record,
      );
    }
  }

  async function search(query: VectorSearchQuery): Promise<VectorHit[]> {
    const q = normalize(query.vector);
    // `model` is the real guard against comparing incomparable vectors; `dim`
    // is a cheap belt-and-suspenders assert (a model's width is fixed, so a
    // model match implies a dim match).
    const params: (string | number)[] = [query.model, q.length];
    let sql = `SELECT resource, record, field, chunk, text, dim, vec
               FROM file_vectors WHERE model = ? AND dim = ?`;
    if (query.resources?.length) {
      sql += ` AND resource IN (${query.resources.map(() => '?').join(', ')})`;
      params.push(...query.resources);
    }
    const rows = db.query(sql).all(...params) as VectorRow[];

    const scored = rows.map((r) => ({
      resource: r.resource,
      record: r.record,
      field: r.field,
      chunk: Number(r.chunk),
      text: r.text,
      score: dot(q, decodeVector(r.vec)),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, query.limit);
  }

  return {
    replace,
    purge,
    search,
    close: () => db.close(),
  };
}
