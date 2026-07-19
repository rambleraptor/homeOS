/**
 * Round-trips the SQLite vector store: replace/search/purge, replace-is-a-full-
 * replace, resource scoping, and dimension isolation. Uses an in-memory db.
 */

import { describe, expect, test } from 'vitest';
import { createSqliteVectorStore } from '../../src/vectors/sqlite-store';
import type { VectorChunk } from '@rambleraptor/homestead-core/server/vectors/types';

function chunk(i: number, text: string, vector: number[]): VectorChunk {
  return { chunk: i, text, vector };
}

function store() {
  return createSqliteVectorStore(':memory:');
}

describe('sqlite vector store', () => {
  test('search returns hits ordered by cosine similarity', async () => {
    const s = store();
    await s.replace({ resource: 'document', record: 'd1', field: 'file' }, [
      chunk(0, 'about cats', [1, 0, 0]),
      chunk(1, 'about dogs', [0, 1, 0]),
      chunk(2, 'about fish', [0, 0, 1]),
    ]);

    const hits = await s.search({ vector: [0.9, 0.1, 0], limit: 2 });
    expect(hits.map((h) => h.text)).toEqual(['about cats', 'about dogs']);
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
    expect(hits[0]).toMatchObject({ resource: 'document', record: 'd1', field: 'file', chunk: 0 });
    s.close();
  });

  test('replace fully replaces a field — no stale chunks survive a shrink', async () => {
    const s = store();
    const scope = { resource: 'document', record: 'd1', field: 'file' };
    await s.replace(scope, [chunk(0, 'v1 a', [1, 0]), chunk(1, 'v1 b', [0, 1])]);
    await s.replace(scope, [chunk(0, 'v2 only', [1, 1])]);

    const hits = await s.search({ vector: [1, 1], limit: 10 });
    expect(hits.map((h) => h.text)).toEqual(['v2 only']);
    s.close();
  });

  test('purge removes a single field but leaves the record’s other fields', async () => {
    const s = store();
    await s.replace({ resource: 'document', record: 'd1', field: 'file' }, [
      chunk(0, 'from file', [1, 0]),
    ]);
    await s.replace({ resource: 'document', record: 'd1', field: 'attachment' }, [
      chunk(0, 'from attachment', [0, 1]),
    ]);

    await s.purge({ resource: 'document', record: 'd1', field: 'file' });
    const hits = await s.search({ vector: [1, 1], limit: 10 });
    expect(hits.map((h) => h.text)).toEqual(['from attachment']);
    s.close();
  });

  test('purge without a field removes every field of the record', async () => {
    const s = store();
    await s.replace({ resource: 'document', record: 'd1', field: 'file' }, [
      chunk(0, 'a', [1, 0]),
    ]);
    await s.replace({ resource: 'document', record: 'd1', field: 'attachment' }, [
      chunk(0, 'b', [0, 1]),
    ]);

    await s.purge({ resource: 'document', record: 'd1' });
    expect(await s.search({ vector: [1, 1], limit: 10 })).toEqual([]);
    s.close();
  });

  test('resource filter restricts the search', async () => {
    const s = store();
    await s.replace({ resource: 'document', record: 'd1', field: 'file' }, [
      chunk(0, 'doc text', [1, 0]),
    ]);
    await s.replace({ resource: 'receipt', record: 'r1', field: 'scan' }, [
      chunk(0, 'receipt text', [1, 0]),
    ]);

    const hits = await s.search({ vector: [1, 0], limit: 10, resources: ['receipt'] });
    expect(hits.map((h) => h.text)).toEqual(['receipt text']);
    s.close();
  });

  test('vectors of a different dimension are never compared', async () => {
    const s = store();
    await s.replace({ resource: 'document', record: 'd1', field: 'file' }, [
      chunk(0, '2d', [1, 0]),
    ]);
    await s.replace({ resource: 'document', record: 'd2', field: 'file' }, [
      chunk(0, '3d', [1, 0, 0]),
    ]);

    // A 3-dim query only matches the 3-dim row.
    const hits = await s.search({ vector: [1, 0, 0], limit: 10 });
    expect(hits.map((h) => h.text)).toEqual(['3d']);
    s.close();
  });
});
