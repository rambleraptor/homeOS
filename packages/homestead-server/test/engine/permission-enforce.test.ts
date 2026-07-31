/**
 * Permissions Phase 3: enforcement wired into the engine, gated by
 * PERMISSIONS_ENFORCED. These run with the flag ON (and a 0ms cache TTL so a
 * just-created grant is honored immediately) and verify: the seeded open grant
 * preserves today's behavior; removing it isolates data to owners; record and
 * deny grants take effect; the superuser break-glass; and shadow mode.
 */

import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { toWireSchema } from '@rambleraptor/homestead-core/resources/translate';
import { PERMISSION_RESOURCE_DEFS } from '@rambleraptor/homestead-core/permissions/resources';
import { seedPermissions } from '@rambleraptor/homestead-core/permissions/seed';
import { BOOK_DEF, call, defineResource, makeEngine, seedUser, type TestEngine } from './helpers';

const BASE = 'http://localhost:8090';

describe('permission enforcement (mode=on)', () => {
  let t: TestEngine;
  const fetchImpl = (input: string, init?: RequestInit) => t.engine.fetch(new Request(input, init));

  beforeEach(async () => {
    process.env.PERMISSION_CACHE_TTL_MS = '0';
    process.env.PERMISSIONS_ENFORCED = 'on';
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
    await defineResource(t, BOOK_DEF);
    await seedPermissions(BASE, t.adminToken, fetchImpl);
  });

  afterEach(() => {
    delete process.env.PERMISSIONS_ENFORCED;
    delete process.env.PERMISSION_CACHE_TTL_MS;
  });

  async function deleteOpenGrant(): Promise<void> {
    const res = await call(t.engine, 'DELETE', '/access-grants/open-household', {
      token: t.adminToken,
    });
    expect(res.status).toBe(204);
  }

  test('the seeded open grant preserves ordinary CRUD for a regular user', async () => {
    const alice = await seedUser(t.engine, { email: 'alice@example.com' });
    expect((await call(t.engine, 'POST', '/books?id=b1', { token: alice.token, body: { title: 'A' } })).status).toBe(201);
    expect((await call(t.engine, 'GET', '/books/b1', { token: alice.token })).status).toBe(200);
    expect((await call(t.engine, 'PATCH', '/books/b1', { token: alice.token, body: { title: 'A2' } })).status).toBe(200);
    const list = await call(t.engine, 'GET', '/books', { token: alice.token });
    expect((await list.json()).results).toHaveLength(1);
    expect((await call(t.engine, 'DELETE', '/books/b1', { token: alice.token })).status).toBe(204);
  });

  test('without the open grant, a record is visible only to its owner', async () => {
    const alice = await seedUser(t.engine, { email: 'alice@example.com' });
    const bob = await seedUser(t.engine, { email: 'bob@example.com' });
    // Alice creates while the open grant still exists (she owns it).
    expect((await call(t.engine, 'POST', '/books?id=b1', { token: alice.token, body: { title: 'A' } })).status).toBe(201);

    await deleteOpenGrant();

    // Owner still reads/writes their record (owner ⇒ manage).
    expect((await call(t.engine, 'GET', '/books/b1', { token: alice.token })).status).toBe(200);
    // A non-owner is denied.
    expect((await call(t.engine, 'GET', '/books/b1', { token: bob.token })).status).toBe(403);
    // Alice can no longer create (no collection write grant remains).
    expect((await call(t.engine, 'POST', '/books?id=b2', { token: alice.token, body: { title: 'B' } })).status).toBe(403);

    // LIST is filtered to the owner's rows.
    expect((await (await call(t.engine, 'GET', '/books', { token: alice.token })).json()).results).toHaveLength(1);
    expect((await (await call(t.engine, 'GET', '/books', { token: bob.token })).json()).results).toHaveLength(0);
  });

  test('a record-scope grant lets a specific user read a specific record', async () => {
    const alice = await seedUser(t.engine, { email: 'alice@example.com' });
    const bob = await seedUser(t.engine, { email: 'bob@example.com' });
    await call(t.engine, 'POST', '/books?id=b1', { token: alice.token, body: { title: 'A' } });
    await call(t.engine, 'POST', '/books?id=b2', { token: alice.token, body: { title: 'A2' } });
    await deleteOpenGrant();

    // Share only b1 with bob.
    await call(t.engine, 'POST', '/access-grants?id=share1', {
      token: t.adminToken,
      body: {
        subject_type: 'user',
        subject_id: bob.user.id,
        target_scope: 'record',
        resource_type: 'book',
        resource_id: 'b1',
        capability: 'read',
      },
    });

    expect((await call(t.engine, 'GET', '/books/b1', { token: bob.token })).status).toBe(200);
    expect((await call(t.engine, 'GET', '/books/b2', { token: bob.token })).status).toBe(403);
    // bob's LIST shows only the shared record.
    const ids = (await (await call(t.engine, 'GET', '/books', { token: bob.token })).json()).results.map(
      (r: { id: string }) => r.id,
    );
    expect(ids).toEqual(['b1']);
  });

  test('a deny grant beats the open grant (deny always wins)', async () => {
    const bob = await seedUser(t.engine, { email: 'bob@example.com' });
    await call(t.engine, 'POST', '/books?id=b1', { token: bob.token, body: { title: 'B' } });
    // Deny bob read everywhere.
    await call(t.engine, 'POST', '/access-grants?id=denybob', {
      token: t.adminToken,
      body: { subject_type: 'user', subject_id: bob.user.id, target_scope: 'all', capability: 'read', effect: 'deny' },
    });
    // Even his own record is now unreadable (deny beats owner).
    expect((await call(t.engine, 'GET', '/books/b1', { token: bob.token })).status).toBe(403);
    // A different user is unaffected.
    const alice = await seedUser(t.engine, { email: 'alice@example.com' });
    expect((await call(t.engine, 'GET', '/books/b1', { token: alice.token })).status).toBe(200);
  });

  test('the superuser account bypasses grants and denies (break-glass)', async () => {
    const bob = await seedUser(t.engine, { email: 'bob@example.com' });
    await call(t.engine, 'POST', '/books?id=b1', { token: bob.token, body: { title: 'B' } });
    await deleteOpenGrant();
    await call(t.engine, 'POST', '/access-grants?id=denyall', {
      token: t.adminToken,
      body: { subject_type: 'everyone', target_scope: 'all', capability: 'manage', effect: 'deny' },
    });
    // Superuser still reads and lists everything.
    expect((await call(t.engine, 'GET', '/books/b1', { token: t.adminToken })).status).toBe(200);
    expect((await (await call(t.engine, 'GET', '/books', { token: t.adminToken })).json()).results).toHaveLength(1);
  });

  test('user-parented resources stay owner-only even under the open grant', async () => {
    // The blanket everyone→write→* grant must NOT widen access to another
    // user's subtree; checkUserScope still isolates user-parented children.
    await defineResource(t, {
      singular: 'note',
      plural: 'notes',
      parents: ['user'],
      schema: { type: 'object', properties: { body: { type: 'string' } } },
    });
    const alice = await seedUser(t.engine, { email: 'alice@example.com' });
    const bob = await seedUser(t.engine, { email: 'bob@example.com' });

    expect(
      (await call(t.engine, 'POST', `/users/${alice.user.id}/notes?id=n1`, { token: alice.token, body: { body: 'secret' } })).status,
    ).toBe(201);
    // Bob cannot reach Alice's note despite the open grant.
    expect((await call(t.engine, 'GET', `/users/${alice.user.id}/notes/n1`, { token: bob.token })).status).toBe(403);
    // Alice can.
    expect((await call(t.engine, 'GET', `/users/${alice.user.id}/notes/n1`, { token: alice.token })).status).toBe(200);
  });

  test('shadow mode logs but does not deny', async () => {
    const alice = await seedUser(t.engine, { email: 'alice@example.com' });
    const bob = await seedUser(t.engine, { email: 'bob@example.com' });
    await call(t.engine, 'POST', '/books?id=b1', { token: alice.token, body: { title: 'A' } });
    await deleteOpenGrant();

    process.env.PERMISSIONS_ENFORCED = 'shadow';
    // Would be denied under 'on', but shadow allows it through.
    expect((await call(t.engine, 'GET', '/books/b1', { token: bob.token })).status).toBe(200);
    // Lists are not trimmed in shadow mode either.
    expect((await (await call(t.engine, 'GET', '/books', { token: bob.token })).json()).results).toHaveLength(1);
  });
});
