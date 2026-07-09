/**
 * `superuser_write` enforcement: resources flagged superuser-write-only
 * (e.g. `account-tag`) may only be mutated by superusers, while regular
 * users keep their normal read access. Plain user-parented resources
 * without the flag stay owner-writable.
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { call, defineResource, makeEngine, seedUser, type TestEngine } from './helpers';

const ACCOUNT_TAG_DEF = {
  singular: 'account-tag',
  plural: 'account-tags',
  superuser_write: true,
  parents: ['user'],
  schema: { type: 'object', properties: { name: { type: 'string' } } },
};

const NOTE_DEF = {
  singular: 'note',
  plural: 'notes',
  parents: ['user'],
  schema: { type: 'object', properties: { body: { type: 'string' } } },
};

describe('superuser_write enforcement', () => {
  let t: TestEngine;

  beforeEach(async () => {
    t = await makeEngine();
    await defineResource(t, ACCOUNT_TAG_DEF);
    await defineResource(t, NOTE_DEF);
  });

  test('the flag round-trips through the definition store', async () => {
    const res = await call(t.engine, 'GET', '/aep-resource-definitions/account-tag', {
      token: t.adminToken,
    });
    expect(res.status).toBe(200);
    expect((await res.json()).superuser_write).toBe(true);
  });

  test('a regular user cannot create their own account tag', async () => {
    const u = await seedUser(t.engine, { email: 'u@example.com' });
    const res = await call(t.engine, 'POST', `/users/${u.user.id}/account-tags`, {
      token: u.token,
      body: { name: 'vip' },
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error.message).toBe('only superusers can modify this resource');
  });

  test('a regular user can still read their own account tags', async () => {
    const u = await seedUser(t.engine, { email: 'u@example.com' });
    // Superuser assigns a tag.
    const created = await call(t.engine, 'POST', `/users/${u.user.id}/account-tags`, {
      token: t.adminToken,
      body: { name: 'vip' },
    });
    expect(created.status).toBe(200);

    const list = await call(t.engine, 'GET', `/users/${u.user.id}/account-tags`, {
      token: u.token,
    });
    expect(list.status).toBe(200);
    expect((await list.json()).results.map((r: { name: string }) => r.name)).toEqual(['vip']);
  });

  test('a regular user cannot update or delete their own account tag', async () => {
    const u = await seedUser(t.engine, { email: 'u@example.com' });
    const created = await call(t.engine, 'POST', `/users/${u.user.id}/account-tags?id=t1`, {
      token: t.adminToken,
      body: { name: 'vip' },
    });
    expect(created.status).toBe(200);

    const patched = await call(t.engine, 'PATCH', `/users/${u.user.id}/account-tags/t1`, {
      token: u.token,
      body: { name: 'hacked' },
    });
    expect(patched.status).toBe(403);

    const deleted = await call(t.engine, 'DELETE', `/users/${u.user.id}/account-tags/t1`, {
      token: u.token,
    });
    expect(deleted.status).toBe(403);
  });

  test('superusers can create, update, and delete account tags', async () => {
    const u = await seedUser(t.engine, { email: 'u@example.com' });
    const created = await call(t.engine, 'POST', `/users/${u.user.id}/account-tags?id=t1`, {
      token: t.adminToken,
      body: { name: 'vip' },
    });
    expect(created.status).toBe(200);

    const patched = await call(t.engine, 'PATCH', `/users/${u.user.id}/account-tags/t1`, {
      token: t.adminToken,
      body: { name: 'beta' },
    });
    expect(patched.status).toBe(200);

    const deleted = await call(t.engine, 'DELETE', `/users/${u.user.id}/account-tags/t1`, {
      token: t.adminToken,
    });
    expect(deleted.status).toBe(204);
  });

  test('user-parented resources without the flag stay owner-writable', async () => {
    const u = await seedUser(t.engine, { email: 'u@example.com' });
    const created = await call(t.engine, 'POST', `/users/${u.user.id}/notes`, {
      token: u.token,
      body: { body: 'mine' },
    });
    expect(created.status).toBe(200);

    // But another user still can't write into this user's notes.
    const other = await seedUser(t.engine, { email: 'other@example.com' });
    const denied = await call(t.engine, 'POST', `/users/${u.user.id}/notes`, {
      token: other.token,
      body: { body: 'intruder' },
    });
    expect(denied.status).toBe(403);
  });
});
