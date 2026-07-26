import { beforeEach, describe, expect, test } from 'vitest';
import { call, defineResource, makeEngine, seedUser, BOOK_DEF, type TestEngine } from './helpers';

let t: TestEngine;

beforeEach(async () => {
  t = await makeEngine();
  const res = await defineResource(t, BOOK_DEF);
  expect(res.status).toBe(200);
});

describe('create', () => {
  test('returns 201 Created with the stored resource', async () => {
    const res = await call(t.engine, 'POST', '/books', {
      token: t.adminToken,
      body: { title: 'Dune', pages: 412 },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe('Dune');
    expect(body.pages).toBe(412);
    expect(body.id).toMatch(/^[0-9a-f]+$/);
    expect(body.path).toBe(`books/${body.id}`);
    expect(body.create_time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  test('honors ?id= for user-settable creates and 409s on duplicates', async () => {
    const res = await call(t.engine, 'POST', '/books?id=my-book', {
      token: t.adminToken,
      body: { title: 'A' },
    });
    expect((await res.json()).id).toBe('my-book');

    const dup = await call(t.engine, 'POST', '/books?id=my-book', {
      token: t.adminToken,
      body: { title: 'B' },
    });
    expect(dup.status).toBe(409);
    expect((await dup.json()).error.message).toContain('already exists');
  });

  test('validates required fields, types, and strips standard fields', async () => {
    const missing = await call(t.engine, 'POST', '/books', {
      token: t.adminToken,
      body: { pages: 1 },
    });
    expect(missing.status).toBe(400);
    expect((await missing.json()).error.message).toBe('missing required fields: title');

    const badType = await call(t.engine, 'POST', '/books', {
      token: t.adminToken,
      body: { title: 'X', pages: 'lots' },
    });
    expect(badType.status).toBe(400);
    expect((await badType.json()).error.message).toBe('field "pages" must be an integer');

    const sneaky = await call(t.engine, 'POST', '/books', {
      token: t.adminToken,
      body: { title: 'X', id: 'hax', create_time: 'then' },
    });
    const body = await sneaky.json();
    expect(body.id).not.toBe('hax');
    expect(body.create_time).not.toBe('then');
  });

  test('round-trips object/array/boolean fields', async () => {
    const res = await call(t.engine, 'POST', '/books', {
      token: t.adminToken,
      body: {
        title: 'X',
        in_print: true,
        tags: ['a', 'b'],
        metadata: { isbn: '123' },
      },
    });
    const created = await res.json();
    const got = await (
      await call(t.engine, 'GET', `/books/${created.id}`, { token: t.adminToken })
    ).json();
    expect(got.in_print).toBe(true);
    expect(got.tags).toEqual(['a', 'b']);
    expect(got.metadata).toEqual({ isbn: '123' });
  });
});

describe('defaults', () => {
  const WIDGET_DEF = {
    singular: 'widget',
    plural: 'widgets',
    user_settable_create: true,
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        enabled: { type: 'boolean', default: false },
        count: { type: 'integer', default: 3 },
        tags: { type: 'array', default: ['new'] },
      },
      required: ['name'],
    },
  };

  beforeEach(async () => {
    expect((await defineResource(t, WIDGET_DEF)).status).toBe(200);
  });

  test('applies declared defaults for absent fields on create', async () => {
    const res = await call(t.engine, 'POST', '/widgets', {
      token: t.adminToken,
      body: { name: 'W' },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.enabled).toBe(false);
    expect(body.count).toBe(3);
    expect(body.tags).toEqual(['new']);
  });

  test('does not override values sent over the wire', async () => {
    const res = await call(t.engine, 'POST', '/widgets', {
      token: t.adminToken,
      body: { name: 'W', enabled: true, count: 9, tags: [] },
    });
    const body = await res.json();
    expect(body.enabled).toBe(true);
    expect(body.count).toBe(9);
    expect(body.tags).toEqual([]);
  });

  test('default array is deep-cloned, not shared across records', async () => {
    const a = await (
      await call(t.engine, 'POST', '/widgets', { token: t.adminToken, body: { name: 'A' } })
    ).json();
    (a.tags as string[]).push('mutated');
    const b = await (
      await call(t.engine, 'POST', '/widgets', { token: t.adminToken, body: { name: 'B' } })
    ).json();
    expect(b.tags).toEqual(['new']);
  });

  test('defaults persist and survive read-back', async () => {
    const created = await (
      await call(t.engine, 'POST', '/widgets', { token: t.adminToken, body: { name: 'W' } })
    ).json();
    const got = await (
      await call(t.engine, 'GET', `/widgets/${created.id}`, { token: t.adminToken })
    ).json();
    expect(got.enabled).toBe(false);
    expect(got.count).toBe(3);
  });
});

describe('get', () => {
  test('404 envelope for a missing resource', async () => {
    const res = await call(t.engine, 'GET', '/books/nope', { token: t.adminToken });
    expect(res.status).toBe(404);
    expect((await res.json()).error.message).toBe('resource "books/nope" not found');
  });

  test('includes null columns after read-back (Go parity)', async () => {
    const created = await (
      await call(t.engine, 'POST', '/books', { token: t.adminToken, body: { title: 'X' } })
    ).json();
    // Create echo only includes sent fields...
    expect('pages' in created).toBe(false);
    // ...but a fresh GET includes all columns, nulls and all.
    const got = await (
      await call(t.engine, 'GET', `/books/${created.id}`, { token: t.adminToken })
    ).json();
    expect(got.pages).toBeNull();
  });
});

describe('list + pagination', () => {
  test('empty list returns {results: []} with no next_page_token key', async () => {
    const res = await call(t.engine, 'GET', '/books', { token: t.adminToken });
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect('next_page_token' in body).toBe(false);
  });

  test('paginates by id cursor with max_page_size', async () => {
    for (let i = 0; i < 5; i++) {
      await call(t.engine, 'POST', `/books?id=book-${i}`, {
        token: t.adminToken,
        body: { title: `B${i}` },
      });
    }
    const page1 = await (
      await call(t.engine, 'GET', '/books?max_page_size=2', { token: t.adminToken })
    ).json();
    expect(page1.results.length).toBe(2);
    expect(typeof page1.next_page_token).toBe('string');

    const page2 = await (
      await call(t.engine, 'GET', `/books?max_page_size=2&page_token=${encodeURIComponent(page1.next_page_token)}`, {
        token: t.adminToken,
      })
    ).json();
    expect(page2.results.length).toBe(2);
    expect(page2.results[0].id).not.toBe(page1.results[0].id);

    const page3 = await (
      await call(t.engine, 'GET', `/books?max_page_size=2&page_token=${encodeURIComponent(page2.next_page_token)}`, {
        token: t.adminToken,
      })
    ).json();
    expect(page3.results.length).toBe(1);
    expect('next_page_token' in page3).toBe(false);

    const ids = [...page1.results, ...page2.results, ...page3.results].map((r: { id: string }) => r.id);
    expect(new Set(ids).size).toBe(5);
  });

  test('skip drops leading results', async () => {
    for (let i = 0; i < 4; i++) {
      await call(t.engine, 'POST', `/books?id=book-${i}`, {
        token: t.adminToken,
        body: { title: `B${i}` },
      });
    }
    const body = await (
      await call(t.engine, 'GET', '/books?skip=3', { token: t.adminToken })
    ).json();
    expect(body.results.length).toBe(1);
  });

  test('filter narrows results; bad filter is a 400', async () => {
    await call(t.engine, 'POST', '/books?id=a', { token: t.adminToken, body: { title: 'Dune', pages: 400 } });
    await call(t.engine, 'POST', '/books?id=b', { token: t.adminToken, body: { title: 'Hobbit', pages: 300 } });

    const filtered = await (
      await call(t.engine, 'GET', `/books?filter=${encodeURIComponent('title == "Dune" && pages > 100')}`, {
        token: t.adminToken,
      })
    ).json();
    expect(filtered.results.length).toBe(1);
    expect(filtered.results[0].title).toBe('Dune');

    const bad = await call(t.engine, 'GET', `/books?filter=${encodeURIComponent('nonfield == 1')}`, {
      token: t.adminToken,
    });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.message).toContain('invalid filter');
  });
});

describe('update (merge-patch)', () => {
  test('merges provided fields, leaves others, allows null clears', async () => {
    const created = await (
      await call(t.engine, 'POST', '/books', {
        token: t.adminToken,
        body: { title: 'X', pages: 100 },
      })
    ).json();

    const patched = await (
      await call(t.engine, 'PATCH', `/books/${created.id}`, {
        token: t.adminToken,
        body: { pages: null, price: 9.99 },
        contentType: 'text/plain', // Go parses the body regardless of content type
      })
    ).json();
    expect(patched.title).toBe('X');
    expect(patched.pages).toBeNull();
    expect(patched.price).toBe(9.99);
    expect(patched.update_time >= created.update_time).toBe(true);
  });

  test('404 for missing resource', async () => {
    const res = await call(t.engine, 'PATCH', '/books/nope', {
      token: t.adminToken,
      body: { title: 'Y' },
    });
    expect(res.status).toBe(404);
  });
});

describe('delete', () => {
  test('204 on success, 404 when already gone', async () => {
    const created = await (
      await call(t.engine, 'POST', '/books', { token: t.adminToken, body: { title: 'X' } })
    ).json();
    const res = await call(t.engine, 'DELETE', `/books/${created.id}`, { token: t.adminToken });
    expect(res.status).toBe(204);
    const again = await call(t.engine, 'DELETE', `/books/${created.id}`, { token: t.adminToken });
    expect(again.status).toBe(404);
  });
});

describe('apply (PUT)', () => {
  test('creates when missing (201), replaces when present (200)', async () => {
    const createRes = await call(t.engine, 'PUT', '/books/put-book', {
      token: t.adminToken,
      body: { title: 'V1' },
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.id).toBe('put-book');
    expect(created.title).toBe('V1');

    const replaceRes = await call(t.engine, 'PUT', '/books/put-book', {
      token: t.adminToken,
      body: { title: 'V2' },
    });
    expect(replaceRes.status).toBe(200);
    const replaced = await replaceRes.json();
    expect(replaced.title).toBe('V2');
    expect(replaced.create_time).toBe(created.create_time);
  });
});

describe('routing quirks', () => {
  test('POST to a resource path without a verb is a 405', async () => {
    const res = await call(t.engine, 'POST', '/books/abc', {
      token: t.adminToken,
      body: {},
    });
    expect(res.status).toBe(405);
    expect((await res.json()).error.message).toBe(
      'POST is not allowed on individual resources; use PATCH to update',
    );
  });

  test('unknown custom method is a 404 envelope', async () => {
    const res = await call(t.engine, 'POST', '/books/abc:frobnicate', {
      token: t.adminToken,
      body: {},
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error.message).toBe('custom method "frobnicate" not found');
  });

  test('unknown collection falls through to the Go-mux text 404', async () => {
    const res = await call(t.engine, 'GET', '/nope', { token: t.adminToken });
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('text/plain');
    expect(await res.text()).toBe('404 page not found\n');
  });

  test('requests without a token are 401 envelopes', async () => {
    const res = await call(t.engine, 'GET', '/books');
    expect(res.status).toBe(401);
    expect((await res.json()).error.message).toBe('missing or invalid Authorization header');
  });
});

describe('nested resources', () => {
  beforeEach(async () => {
    const res = await defineResource(t, {
      singular: 'chapter',
      plural: 'chapters',
      parents: ['book'],
      user_settable_create: true,
      schema: {
        type: 'object',
        properties: { heading: { type: 'string' } },
      },
    });
    expect(res.status).toBe(200);
    await call(t.engine, 'POST', '/books?id=b1', { token: t.adminToken, body: { title: 'B1' } });
    await call(t.engine, 'POST', '/books?id=b2', { token: t.adminToken, body: { title: 'B2' } });
  });

  test('children nest under the parent path and are parent-scoped', async () => {
    const created = await (
      await call(t.engine, 'POST', '/books/b1/chapters?id=c1', {
        token: t.adminToken,
        body: { heading: 'One' },
      })
    ).json();
    expect(created.path).toBe('books/b1/chapters/c1');

    const inB1 = await (
      await call(t.engine, 'GET', '/books/b1/chapters', { token: t.adminToken })
    ).json();
    expect(inB1.results.length).toBe(1);
    const inB2 = await (
      await call(t.engine, 'GET', '/books/b2/chapters', { token: t.adminToken })
    ).json();
    expect(inB2.results.length).toBe(0);

    // Top-level access to a nested collection is not a route.
    const top = await call(t.engine, 'GET', '/chapters', { token: t.adminToken });
    expect(top.status).toBe(404);
  });
});

describe('delete cascade (AEP-135 force)', () => {
  beforeEach(async () => {
    // book -> chapter -> section, three levels deep.
    expect(
      (
        await defineResource(t, {
          singular: 'chapter',
          plural: 'chapters',
          parents: ['book'],
          user_settable_create: true,
          schema: { type: 'object', properties: { heading: { type: 'string' } } },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await defineResource(t, {
          singular: 'section',
          plural: 'sections',
          parents: ['chapter'],
          user_settable_create: true,
          schema: { type: 'object', properties: { body: { type: 'string' } } },
        })
      ).status,
    ).toBe(200);
    await call(t.engine, 'POST', '/books?id=b1', {
      token: t.adminToken,
      body: { title: 'B1' },
    });
    await call(t.engine, 'POST', '/books/b1/chapters?id=c1', {
      token: t.adminToken,
      body: { heading: 'One' },
    });
    await call(t.engine, 'POST', '/books/b1/chapters/c1/sections?id=s1', {
      token: t.adminToken,
      body: { body: 'Text' },
    });
  });

  test('refuses to delete a parent with children without force (409)', async () => {
    const res = await call(t.engine, 'DELETE', '/books/b1', { token: t.adminToken });
    expect(res.status).toBe(409);
    expect((await res.json()).error.message).toContain('child resources');
    // Nothing was deleted.
    expect(
      (await call(t.engine, 'GET', '/books/b1', { token: t.adminToken })).status,
    ).toBe(200);
    expect(
      (await call(t.engine, 'GET', '/books/b1/chapters/c1', { token: t.adminToken }))
        .status,
    ).toBe(200);
  });

  test('force=true cascades through the whole subtree', async () => {
    const res = await call(t.engine, 'DELETE', '/books/b1?force=true', {
      token: t.adminToken,
    });
    expect(res.status).toBe(204);
    expect(
      (await call(t.engine, 'GET', '/books/b1', { token: t.adminToken })).status,
    ).toBe(404);
    expect(
      (await call(t.engine, 'GET', '/books/b1/chapters/c1', { token: t.adminToken }))
        .status,
    ).toBe(404);
    expect(
      (
        await call(t.engine, 'GET', '/books/b1/chapters/c1/sections/s1', {
          token: t.adminToken,
        })
      ).status,
    ).toBe(404);
  });

  test('a childless resource deletes without force', async () => {
    // Leaf section deletes directly; the now-childless chapter then deletes too.
    expect(
      (
        await call(t.engine, 'DELETE', '/books/b1/chapters/c1/sections/s1', {
          token: t.adminToken,
        })
      ).status,
    ).toBe(204);
    expect(
      (await call(t.engine, 'DELETE', '/books/b1/chapters/c1', { token: t.adminToken }))
        .status,
    ).toBe(204);
  });
});

describe('user-parented scoping', () => {
  beforeEach(async () => {
    const res = await defineResource(t, {
      singular: 'note',
      plural: 'notes',
      parents: ['user'],
      schema: { type: 'object', properties: { text: { type: 'string' } } },
    });
    expect(res.status).toBe(200);
  });

  test('regular users only reach their own subtree; superusers reach all', async () => {
    const alice = await seedUser(t.engine, { email: 'alice@example.com' });
    const bob = await seedUser(t.engine, { email: 'bob@example.com' });

    const created = await call(t.engine, 'POST', `/users/${alice.user.id}/notes`, {
      token: alice.token,
      body: { text: 'mine' },
    });
    expect(created.status).toBe(201);

    const denied = await call(t.engine, 'GET', `/users/${alice.user.id}/notes`, {
      token: bob.token,
    });
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.message).toBe('you do not have access to this resource');

    const adminView = await call(t.engine, 'GET', `/users/${alice.user.id}/notes`, {
      token: t.adminToken,
    });
    expect(adminView.status).toBe(200);
    expect((await adminView.json()).results.length).toBe(1);
  });
});

describe('singletons', () => {
  beforeEach(async () => {
    const res = await defineResource(t, {
      singular: 'profile',
      plural: 'profiles',
      parents: ['user'],
      singleton: true,
      schema: { type: 'object', properties: { bio: { type: 'string' } } },
    });
    expect(res.status).toBe(200);
  });

  test('GET implicitly creates; PATCH merges; responses carry no id', async () => {
    const got = await (
      await call(t.engine, 'GET', `/users/${t.admin.id}/profile`, { token: t.adminToken })
    ).json();
    expect(got.path).toBe(`users/${t.admin.id}/profile`);
    expect('id' in got).toBe(false);
    expect('bio' in got).toBe(false);

    const patched = await (
      await call(t.engine, 'PATCH', `/users/${t.admin.id}/profile`, {
        token: t.adminToken,
        body: { bio: 'hello' },
      })
    ).json();
    expect(patched.bio).toBe('hello');
    expect(patched.create_time).toBe(got.create_time);
  });
});
