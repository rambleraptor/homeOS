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
  FieldScope,
  PurgeScope,
  VectorChunk,
  VectorHit,
  VectorSearchQuery,
  VectorStore,
} from '@rambleraptor/homestead-core/server/vectors/types';
import { Database } from '../engine/sqlite';

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

/**
 * Open (creating if needed) the vector store at `dbPath`. A separate SQLite file
 * from the engine's `aepbase.db`, so the index stays decoupled from aepbase's
 * schema management.
 */
export function createSqliteVectorStore(dbPath: string): SqliteVectorStore {
  const db = new Database(dbPath, { create: true });
  db.run(`
    CREATE TABLE IF NOT EXISTS file_vectors (
      resource TEXT NOT NULL,
      record   TEXT NOT NULL,
      field    TEXT NOT NULL,
      chunk    INTEGER NOT NULL,
      text     TEXT NOT NULL,
      dim      INTEGER NOT NULL,
      vec      BLOB NOT NULL,
      PRIMARY KEY (resource, record, field, chunk)
    )
  `);
  db.run(
    `CREATE INDEX IF NOT EXISTS file_vectors_scope ON file_vectors (resource, record, field)`,
  );

  const delField = `DELETE FROM file_vectors WHERE resource = ? AND record = ? AND field = ?`;

  async function replace(scope: FieldScope, chunks: VectorChunk[]): Promise<void> {
    const run = db.transaction(() => {
      db.run(delField, scope.resource, scope.record, scope.field);
      const insert = db.query(
        `INSERT INTO file_vectors (resource, record, field, chunk, text, dim, vec)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const c of chunks) {
        insert.run(
          scope.resource,
          scope.record,
          scope.field,
          c.chunk,
          c.text,
          c.vector.length,
          encodeVector(c.vector),
        );
      }
    });
    run();
  }

  async function purge(scope: PurgeScope): Promise<void> {
    if (scope.field !== undefined) {
      db.run(delField, scope.resource, scope.record, scope.field);
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
    const params: (string | number)[] = [q.length];
    let sql = `SELECT resource, record, field, chunk, text, dim, vec
               FROM file_vectors WHERE dim = ?`;
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
