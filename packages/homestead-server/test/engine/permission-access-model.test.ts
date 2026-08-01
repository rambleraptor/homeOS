/**
 * Permissions Phase 5: per-resource access model (§7). `household` (default)
 * lets the blanket open grant reach every row; `owner` makes rows private to
 * their owner (the open grant no longer confers row access); `acl` ignores the
 * all-scope open grant but honors collection grants. CREATE is never restricted
 * by the model — people can always add records they'll own.
 */

import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { toWireSchema } from '@rambleraptor/homestead-core/resources/translate';
import { PERMISSION_RESOURCE_DEFS } from '@rambleraptor/homestead-core/permissions/resources';
import { seedPermissions } from '@rambleraptor/homestead-core/permissions/seed';
import { call, defineResource, makeEngine, seedUser, type TestEngine } from './helpers';

const BASE = 'http://localhost:8090';

async function defineWithModel(t: TestEngine, singular: string, plural: string, model?: string) {
  const schema: Record<string, unknown> = { type: 'object', properties: { title: { type: 'string' } } };
  if (model) schema['x-homestead-access'] = model;
  return defineResource(t, { singular, plural, user_settable_create: true, schema }, singular);
}

async function listIds(t: TestEngine, plural: string, token: string): Promise<string[]> {
  const res = await call(t.engine, 'GET', `/${plural}`, { token });
  return ((await res.json()).results as Array<{ id: string }>).map((r) => r.id).sort();
}

describe('per-resource access model', () => {
  let t: TestEngine;
  const fetchImpl = (input: string, init?: RequestInit) => t.engine.fetch(new Request(input, init));

  beforeEach(async () => {
    process.env.PERMISSION_CACHE_TTL_MS = '0';
    t = await makeEngine();
    for (const def of PERMISSION_RESOURCE_DEFS) {
      await defineResource(
        t,
        {
          singular: def.singular,
          plural: def.plural,
          parents: def.parents ?? [],
          superuser_write: def.superuser_write ?? false,
          schema: toWireSchema(def.fields, def.singular),
        },
        def.singular,
      );
    }
    await defineWithModel(t, 'book', 'books'); // household (default)
    await defineWithModel(t, 'note', 'notes', 'owner');
    await defineWithModel(t, 'doc', 'docs', 'acl');
    await seedPermissions(BASE, t.adminToken, fetchImpl);
  });

  afterEach(() => {
    delete process.env.PERMISSION_CACHE_TTL_MS;
  });

  test('household: the open grant makes rows shared', async () => {
    const alice = await seedUser(t.engine, { email: 'alice@example.com' });
    const bob = await seedUser(t.engine, { email: 'bob@example.com' });
    await call(t.engine, 'POST', '/books?id=b1', { token: alice.token, body: { title: 'A' } });
    expect((await call(t.engine, 'GET', '/books/b1', { token: bob.token })).status).toBe(200);
    expect(await listIds(t, 'books', bob.token)).toEqual(['b1']);
  });

  test('owner: rows are private to their owner despite the open grant', async () => {
    const alice = await seedUser(t.engine, { email: 'alice@example.com' });
    const bob = await seedUser(t.engine, { email: 'bob@example.com' });
    // CREATE still works (owner model does not restrict adding your own records).
    expect((await call(t.engine, 'POST', '/notes?id=n1', { token: alice.token, body: { title: 'secret' } })).status).toBe(201);

    expect((await call(t.engine, 'GET', '/notes/n1', { token: alice.token })).status).toBe(200); // owner
    expect((await call(t.engine, 'GET', '/notes/n1', { token: bob.token })).status).toBe(403); // not owner
    expect(await listIds(t, 'notes', bob.token)).toEqual([]);
    expect(await listIds(t, 'notes', alice.token)).toEqual(['n1']);
  });

  test('owner: an explicit collection grant opens the resource', async () => {
    const alice = await seedUser(t.engine, { email: 'alice@example.com' });
    const bob = await seedUser(t.engine, { email: 'bob@example.com' });
    await call(t.engine, 'POST', '/notes?id=n1', { token: alice.token, body: { title: 'A' } });
    await call(t.engine, 'POST', '/access-grants?id=opennotes', {
      token: t.adminToken,
      body: { subject_type: 'everyone', target_scope: 'collection', resource_type: 'note', capability: 'read' },
    });
    expect((await call(t.engine, 'GET', '/notes/n1', { token: bob.token })).status).toBe(200);
    expect(await listIds(t, 'notes', bob.token)).toEqual(['n1']);
  });

  test('acl: the all-scope open grant is ignored, collection grants govern', async () => {
    const alice = await seedUser(t.engine, { email: 'alice@example.com' });
    const bob = await seedUser(t.engine, { email: 'bob@example.com' });
    await call(t.engine, 'POST', '/docs?id=d1', { token: alice.token, body: { title: 'A' } });
    // Open (all-scope) grant does not reach acl rows.
    expect((await call(t.engine, 'GET', '/docs/d1', { token: bob.token })).status).toBe(403);
    // A collection grant does.
    await call(t.engine, 'POST', '/access-grants?id=opendocs', {
      token: t.adminToken,
      body: { subject_type: 'everyone', target_scope: 'collection', resource_type: 'doc', capability: 'read' },
    });
    expect((await call(t.engine, 'GET', '/docs/d1', { token: bob.token })).status).toBe(200);
  });
});
