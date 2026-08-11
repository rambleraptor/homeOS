import { beforeEach, describe, expect, test } from 'vitest';
import { call, defineResource, makeEngine, seedUser, BOOK_DEF, type TestEngine } from './helpers';

let t: TestEngine;

beforeEach(async () => {
  t = await makeEngine();
});

describe('definition create', () => {
  test('persists, registers routes, and echoes the definition', async () => {
    const res = await defineResource(t, BOOK_DEF);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('book');
    expect(body.path).toBe('aep-resource-definitions/book');
    expect(typeof body.create_time).toBe('string');

    // Routes are live immediately.
    const list = await call(t.engine, 'GET', '/books', { token: t.adminToken });
    expect(list.status).toBe(200);
  });

  test('validates singular/plural and parent existence', async () => {
    const bad = await defineResource(t, { singular: 'x', schema: { type: 'object', properties: {} } });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.message).toBe('singular and plural are required');

    const orphan = await defineResource(t, {
      singular: 'x',
      plural: 'xs',
      parents: ['ghost'],
      schema: { type: 'object', properties: {} },
    });
    expect(orphan.status).toBe(400);
    expect((await orphan.json()).error.message).toBe('parent resource "ghost" not found');

    const underscore = await defineResource(t, {
      singular: 'x',
      plural: '_xs',
      schema: { type: 'object', properties: {} },
    });
    expect(underscore.status).toBe(400);
  });

  test('409 on duplicate id', async () => {
    await defineResource(t, BOOK_DEF);
    const dup = await defineResource(t, BOOK_DEF);
    expect(dup.status).toBe(409);
  });

  test('detects x-aepbase-file-field markers into file_fields', async () => {
    const res = await defineResource(t, {
      singular: 'doc',
      plural: 'docs',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          attachment: { type: 'binary', 'x-aepbase-file-field': true },
        },
      },
    });
    const body = await res.json();
    expect(body.file_fields).toEqual(['attachment']);
    expect(body.schema.properties.attachment['x-aepbase-file-field']).toBe(true);
  });

  test('singletons require a parent', async () => {
    const res = await defineResource(t, {
      singular: 'config',
      plural: 'configs',
      singleton: true,
      schema: { type: 'object', properties: {} },
    });
    expect(res.status).toBe(400);
  });
});

describe('definition get/list', () => {
  test('get by id, 404 when missing', async () => {
    await defineResource(t, BOOK_DEF);
    const res = await call(t.engine, 'GET', '/aep-resource-definitions/book', {
      token: t.adminToken,
    });
    expect(res.status).toBe(200);
    expect((await res.json()).plural).toBe('books');

    const missing = await call(t.engine, 'GET', '/aep-resource-definitions/none', {
      token: t.adminToken,
    });
    expect(missing.status).toBe(404);
  });

  test('list returns the envelope', async () => {
    await defineResource(t, BOOK_DEF);
    const res = await call(t.engine, 'GET', '/aep-resource-definitions?max_page_size=200', {
      token: t.adminToken,
    });
    const body = await res.json();
    expect(body.results.map((d: { id: string }) => d.id)).toEqual(['book']);
  });
});

describe('definition update', () => {
  beforeEach(async () => {
    await defineResource(t, BOOK_DEF);
    await call(t.engine, 'POST', '/books?id=b1', {
      token: t.adminToken,
      body: { title: 'Keep me', pages: 9 },
    });
  });

  test('adding a property adds a column, existing data preserved', async () => {
    const newSchema = structuredClone(BOOK_DEF.schema) as Record<string, unknown>;
    (newSchema.properties as Record<string, unknown>).subtitle = { type: 'string' };
    const res = await call(t.engine, 'PATCH', '/aep-resource-definitions/book', {
      token: t.adminToken,
      body: { schema: newSchema },
    });
    expect(res.status).toBe(200);

    const updated = await (
      await call(t.engine, 'PATCH', '/books/b1', {
        token: t.adminToken,
        body: { subtitle: 'New' },
      })
    ).json();
    expect(updated.subtitle).toBe('New');
    expect(updated.title).toBe('Keep me');
  });

  test('removing a property drops the column, other data preserved', async () => {
    const newSchema = structuredClone(BOOK_DEF.schema) as { properties: Record<string, unknown> };
    delete newSchema.properties.pages;
    const res = await call(t.engine, 'PATCH', '/aep-resource-definitions/book', {
      token: t.adminToken,
      body: { schema: newSchema },
    });
    expect(res.status).toBe(200);

    const got = await (
      await call(t.engine, 'GET', '/books/b1', { token: t.adminToken })
    ).json();
    expect(got.title).toBe('Keep me');
    expect('pages' in got).toBe(false);
  });

  test('rejects type changes, renames, and parent changes', async () => {
    const typeChange = structuredClone(BOOK_DEF.schema) as { properties: Record<string, { type: string }> };
    typeChange.properties.pages = { type: 'string' };
    const res = await call(t.engine, 'PATCH', '/aep-resource-definitions/book', {
      token: t.adminToken,
      body: { schema: typeChange },
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toContain('cannot change type');

    const rename = await call(t.engine, 'PATCH', '/aep-resource-definitions/book', {
      token: t.adminToken,
      body: { singular: 'tome' },
    });
    expect(rename.status).toBe(400);
    expect((await rename.json()).error.message).toBe('changing singular name is not supported');

    const reparent = await call(t.engine, 'PATCH', '/aep-resource-definitions/book', {
      token: t.adminToken,
      body: { parents: ['user'] },
    });
    expect(reparent.status).toBe(400);
    expect((await reparent.json()).error.message).toBe('changing parents is not supported');
  });
});

describe('definition delete', () => {
  test('removes routes and table; blocked while children exist', async () => {
    await defineResource(t, BOOK_DEF);
    await defineResource(t, {
      singular: 'chapter',
      plural: 'chapters',
      parents: ['book'],
      schema: { type: 'object', properties: {} },
    });

    const blocked = await call(t.engine, 'DELETE', '/aep-resource-definitions/book', {
      token: t.adminToken,
    });
    expect(blocked.status).toBe(400);
    expect((await blocked.json()).error.message).toContain('children depend on it');

    const childGone = await call(t.engine, 'DELETE', '/aep-resource-definitions/chapter', {
      token: t.adminToken,
    });
    expect(childGone.status).toBe(204);
    const gone = await call(t.engine, 'DELETE', '/aep-resource-definitions/book', {
      token: t.adminToken,
    });
    expect(gone.status).toBe(204);

    const list = await call(t.engine, 'GET', '/books', { token: t.adminToken });
    expect(list.status).toBe(404); // routes are gone
  });
});

describe('authorization: only superusers may mutate definitions', () => {
  test('a regular user is denied create/update/delete but may read', async () => {
    // Seed the schema as the superuser so there is something to read/mutate.
    await defineResource(t, BOOK_DEF);
    const { token: userToken } = await seedUser(t.engine, {
      email: 'regular@example.com',
      type: 'regular',
    });

    const create = await call(t.engine, 'POST', '/aep-resource-definitions', {
      token: userToken,
      body: { singular: 'note', plural: 'notes', schema: { type: 'object', properties: {} } },
    });
    expect(create.status).toBe(403);

    const patch = await call(t.engine, 'PATCH', '/aep-resource-definitions/book', {
      token: userToken,
      body: { description: 'hijacked' },
    });
    expect(patch.status).toBe(403);

    const del = await call(t.engine, 'DELETE', '/aep-resource-definitions/book', {
      token: userToken,
    });
    expect(del.status).toBe(403);

    // The write protection held: the definition is untouched.
    const still = await call(t.engine, 'GET', '/aep-resource-definitions/book', {
      token: t.adminToken,
    });
    expect(still.status).toBe(200);
    expect((await still.json()).description).toBeUndefined();

    // Reads remain open to any authenticated caller.
    const read = await call(t.engine, 'GET', '/aep-resource-definitions/book', {
      token: userToken,
    });
    expect(read.status).toBe(200);
    const list = await call(t.engine, 'GET', '/aep-resource-definitions', { token: userToken });
    expect(list.status).toBe(200);
  });
});

describe('persistence across engine restarts', () => {
  test('definitions restore from the db in topological order', async () => {
    // Use a real file so a second Engine can re-open it.
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'hs-restart-'));
    const { Engine } = await import('../../src/engine/engine');

    const first = new Engine({
      dbPath: join(dir, 'aepbase.db'),
      filesDir: join(dir, 'files'),
      serverUrl: 'http://localhost:8090',
    });
    const { seedUser } = await import('./helpers');
    const admin = await seedUser(first, { email: 'a@example.com', type: 'superuser' });
    const mk = (def: unknown) =>
      first.fetch(
        new Request('http://localhost:8090/aep-resource-definitions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${admin.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(def),
        }),
      );
    // Create child-after-parent, but the restore path must topo-sort anyway.
    await mk(BOOK_DEF);
    await mk({
      singular: 'chapter',
      plural: 'chapters',
      parents: ['book'],
      schema: { type: 'object', properties: {} },
    });
    first.db.close();

    const second = new Engine({
      dbPath: join(dir, 'aepbase.db'),
      filesDir: join(dir, 'files'),
      serverUrl: 'http://localhost:8090',
    });
    expect(second.registry.has('book')).toBe(true);
    expect(second.registry.has('chapter')).toBe(true);
    expect(second.registry.get('chapter')!.patternElems).toEqual([
      'books',
      '{book_id}',
      'chapters',
      '{chapter_id}',
    ]);
  });
});
