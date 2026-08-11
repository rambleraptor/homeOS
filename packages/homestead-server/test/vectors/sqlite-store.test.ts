/**
 * Round-trips the SQLite vector store: replace/search/purge, replace-is-a-full-
 * replace, resource scoping, dimension isolation, per-model isolation and
 * coexistence, and the legacy (pre-`model`) schema migration. Uses an in-memory
 * db except the migration test, which needs a real file to reopen.
 */

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { createSqliteVectorStore, LEGACY_MODEL } from '../../src/vectors/sqlite-store';
import { Database } from '../../src/engine/sqlite';
import type { VectorChunk } from '@rambleraptor/homestead-core/server/vectors/types';

/** A stand-in embedding model identity for tests that only need one model. */
const M = 'openai:test-embedding';

function chunk(i: number, text: string, vector: number[]): VectorChunk {
  return { chunk: i, text, vector };
}

function store() {
  return createSqliteVectorStore(':memory:');
}

describe('sqlite vector store', () => {
  test('search returns hits ordered by cosine similarity', async () => {
    const s = store();
    await s.replace({ resource: 'document', record: 'd1', field: 'file', model: M }, [
      chunk(0, 'about cats', [1, 0, 0]),
      chunk(1, 'about dogs', [0, 1, 0]),
      chunk(2, 'about fish', [0, 0, 1]),
    ]);

    const hits = await s.search({ vector: [0.9, 0.1, 0], model: M, limit: 2 });
    expect(hits.map((h) => h.text)).toEqual(['about cats', 'about dogs']);
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
    expect(hits[0]).toMatchObject({ resource: 'document', record: 'd1', field: 'file', chunk: 0 });
    s.close();
  });

  test('replace fully replaces a field — no stale chunks survive a shrink', async () => {
    const s = store();
    const scope = { resource: 'document', record: 'd1', field: 'file', model: M };
    await s.replace(scope, [chunk(0, 'v1 a', [1, 0]), chunk(1, 'v1 b', [0, 1])]);
    await s.replace(scope, [chunk(0, 'v2 only', [1, 1])]);

    const hits = await s.search({ vector: [1, 1], model: M, limit: 10 });
    expect(hits.map((h) => h.text)).toEqual(['v2 only']);
    s.close();
  });

  test('purge removes a single field but leaves the record’s other fields', async () => {
    const s = store();
    await s.replace({ resource: 'document', record: 'd1', field: 'file', model: M }, [
      chunk(0, 'from file', [1, 0]),
    ]);
    await s.replace({ resource: 'document', record: 'd1', field: 'attachment', model: M }, [
      chunk(0, 'from attachment', [0, 1]),
    ]);

    await s.purge({ resource: 'document', record: 'd1', field: 'file' });
    const hits = await s.search({ vector: [1, 1], model: M, limit: 10 });
    expect(hits.map((h) => h.text)).toEqual(['from attachment']);
    s.close();
  });

  test('purge without a field removes every field of the record', async () => {
    const s = store();
    await s.replace({ resource: 'document', record: 'd1', field: 'file', model: M }, [
      chunk(0, 'a', [1, 0]),
    ]);
    await s.replace({ resource: 'document', record: 'd1', field: 'attachment', model: M }, [
      chunk(0, 'b', [0, 1]),
    ]);

    await s.purge({ resource: 'document', record: 'd1' });
    expect(await s.search({ vector: [1, 1], model: M, limit: 10 })).toEqual([]);
    s.close();
  });

  test('purge spans every model for the field', async () => {
    const s = store();
    const scope = { resource: 'document', record: 'd1', field: 'file' };
    await s.replace({ ...scope, model: 'openai:a' }, [chunk(0, 'from a', [1, 0])]);
    await s.replace({ ...scope, model: 'google:b' }, [chunk(0, 'from b', [1, 0])]);

    await s.purge(scope);
    expect(await s.search({ vector: [1, 0], model: 'openai:a', limit: 10 })).toEqual([]);
    expect(await s.search({ vector: [1, 0], model: 'google:b', limit: 10 })).toEqual([]);
    s.close();
  });

  test('resource filter restricts the search', async () => {
    const s = store();
    await s.replace({ resource: 'document', record: 'd1', field: 'file', model: M }, [
      chunk(0, 'doc text', [1, 0]),
    ]);
    await s.replace({ resource: 'receipt', record: 'r1', field: 'scan', model: M }, [
      chunk(0, 'receipt text', [1, 0]),
    ]);

    const hits = await s.search({ vector: [1, 0], model: M, limit: 10, resources: ['receipt'] });
    expect(hits.map((h) => h.text)).toEqual(['receipt text']);
    s.close();
  });

  test('vectors of a different dimension are never compared', async () => {
    const s = store();
    await s.replace({ resource: 'document', record: 'd1', field: 'file', model: M }, [
      chunk(0, '2d', [1, 0]),
    ]);
    await s.replace({ resource: 'document', record: 'd2', field: 'file', model: M }, [
      chunk(0, '3d', [1, 0, 0]),
    ]);

    // A 3-dim query only matches the 3-dim row.
    const hits = await s.search({ vector: [1, 0, 0], model: M, limit: 10 });
    expect(hits.map((h) => h.text)).toEqual(['3d']);
    s.close();
  });

  test('a query matches only vectors from the same model — even at the same dimension', async () => {
    const s = store();
    const scope = { resource: 'document', record: 'd1', field: 'file' };
    // Two models, identical dimension and stored vector: without model tagging
    // these would (wrongly) score against each other.
    await s.replace({ ...scope, model: 'openai:a' }, [chunk(0, 'from model a', [1, 0])]);
    await s.replace({ ...scope, model: 'google:b' }, [chunk(0, 'from model b', [1, 0])]);

    expect((await s.search({ vector: [1, 0], model: 'openai:a', limit: 10 })).map((h) => h.text)).toEqual([
      'from model a',
    ]);
    expect((await s.search({ vector: [1, 0], model: 'google:b', limit: 10 })).map((h) => h.text)).toEqual([
      'from model b',
    ]);
    // A model with nothing stored gets no hits.
    expect(await s.search({ vector: [1, 0], model: 'openai:c', limit: 10 })).toEqual([]);
    s.close();
  });

  test('replace under one model leaves another model’s vectors for the same field intact', async () => {
    const s = store();
    const scope = { resource: 'document', record: 'd1', field: 'file' };
    await s.replace({ ...scope, model: 'openai:a' }, [chunk(0, 'a v1', [1, 0]), chunk(1, 'a v2', [0, 1])]);
    await s.replace({ ...scope, model: 'google:b' }, [chunk(0, 'b v1', [1, 0])]);

    // Re-embed (shrink) under model a; model b must be untouched.
    await s.replace({ ...scope, model: 'openai:a' }, [chunk(0, 'a only', [1, 1])]);

    expect((await s.search({ vector: [1, 1], model: 'openai:a', limit: 10 })).map((h) => h.text)).toEqual([
      'a only',
    ]);
    expect((await s.search({ vector: [1, 0], model: 'google:b', limit: 10 })).map((h) => h.text)).toEqual([
      'b v1',
    ]);
    s.close();
  });
});

describe('sqlite vector store — durability', () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('a file-backed store is opened in WAL mode', () => {
    dir = mkdtempSync(join(tmpdir(), 'homestead-vec-wal-'));
    const dbPath = join(dir, 'vectors.db');
    // The store creates its schema (a write) on open; in WAL mode — and only in
    // WAL mode — that produces the `-wal` sidecar, which persists while the
    // connection stays open. Its presence is a runtime-agnostic proof of WAL,
    // avoiding a second connection (bun:sqlite vs node:sqlite differ).
    createSqliteVectorStore(dbPath);
    expect(existsSync(`${dbPath}-wal`)).toBe(true);
  });
});

describe('sqlite vector store — legacy migration', () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('a pre-model db is migrated: rows are quarantined under LEGACY_MODEL', async () => {
    dir = mkdtempSync(join(tmpdir(), 'homestead-vec-'));
    const dbPath = join(dir, 'vectors.db');

    // Hand-build the old, pre-`model` schema and seed one row.
    const legacy = new Database(dbPath, { create: true });
    legacy.run(`
      CREATE TABLE file_vectors (
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
    const vec = new Uint8Array(new Float32Array([1, 0]).buffer);
    legacy.run(
      `INSERT INTO file_vectors (resource, record, field, chunk, text, dim, vec)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      'document',
      'd1',
      'file',
      0,
      'legacy text',
      2,
      vec,
    );
    legacy.close();

    // Reopening runs the migration.
    const s = createSqliteVectorStore(dbPath);

    // A real model never sees the untagged legacy row...
    expect(await s.search({ vector: [1, 0], model: M, limit: 10 })).toEqual([]);
    // ...but the text is preserved, quarantined under the sentinel model.
    const legacyHits = await s.search({ vector: [1, 0], model: LEGACY_MODEL, limit: 10 });
    expect(legacyHits.map((h) => h.text)).toEqual(['legacy text']);
    expect(legacyHits[0]).toMatchObject({ resource: 'document', record: 'd1', field: 'file' });

    // Re-embedding under a real model coexists with the quarantined legacy row.
    await s.replace({ resource: 'document', record: 'd1', field: 'file', model: M }, [
      chunk(0, 'fresh text', [1, 0]),
    ]);
    expect((await s.search({ vector: [1, 0], model: M, limit: 10 })).map((h) => h.text)).toEqual([
      'fresh text',
    ]);
    s.close();

    // The migration is idempotent — reopening again is a clean no-op.
    const again = createSqliteVectorStore(dbPath);
    expect((await again.search({ vector: [1, 0], model: M, limit: 10 })).map((h) => h.text)).toEqual([
      'fresh text',
    ]);
    again.close();
  });
});
