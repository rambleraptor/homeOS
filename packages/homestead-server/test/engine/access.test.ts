/** Port of aepbase/middleware_test.go plus an end-to-end gate scenario. */

import { beforeEach, describe, expect, test } from 'bun:test';
import {
  AccessStore,
  appFieldName,
  decide,
  makeAccessCheck,
  parseTagSet,
} from '../../src/engine/access';
import { call, defineResource, makeEngine, seedUser, type TestEngine } from './helpers';

describe('decide', () => {
  test('none denies everyone, even superusers', () => {
    expect(decide('none', true, ['a'], 'a')).toBe(false);
    expect(decide('none', false, [], '')).toBe(false);
  });

  test('all (and unknown values) allow any signed-in user', () => {
    expect(decide('all', false, [], '')).toBe(true);
    expect(decide('garbage', false, [], '')).toBe(true);
    expect(decide('', false, [], '')).toBe(true);
  });

  test('superusers gate', () => {
    expect(decide('superusers', true, [], '')).toBe(true);
    expect(decide('superusers', false, ['vip'], 'vip')).toBe(false);
  });

  test('tagged requires a tag intersection', () => {
    expect(decide('tagged', false, ['vip'], 'vip, beta')).toBe(true);
    expect(decide('tagged', false, ['other'], 'vip')).toBe(false);
    expect(decide('tagged', false, [], 'vip')).toBe(false);
    // Empty enabled_tags denies everyone — including superusers.
    expect(decide('tagged', true, ['vip'], '')).toBe(false);
  });
});

describe('parseTagSet', () => {
  test('splits, trims, drops empties', () => {
    expect([...parseTagSet('a, b ,,c')].sort()).toEqual(['a', 'b', 'c']);
    expect(parseTagSet('').size).toBe(0);
    expect(parseTagSet(' , ').size).toBe(0);
  });
});

describe('appFieldName', () => {
  test('flattens app id + key with dashes to underscores', () => {
    expect(appFieldName('gift-cards', 'enabled')).toBe('gift_cards__enabled');
    expect(appFieldName('todos', 'enabled_tags')).toBe('todos__enabled_tags');
  });
});

describe('AccessStore', () => {
  let t: TestEngine;

  beforeEach(async () => {
    t = await makeEngine();
  });

  test('missing app_flags table falls back to defaults', () => {
    const store = new AccessStore(t.engine.db, 0);
    expect(store.loadFlags()).toEqual({});
    expect(store.visibility('gift-cards', 'superusers').vis).toBe('superusers');
    expect(store.visibility('gift-cards', undefined).vis).toBe('all');
    expect(store.visibility('gift-cards', 'bogus').vis).toBe('all');
  });

  test('reads the app_flags row and caches it for the TTL', async () => {
    await defineResource(t, {
      singular: 'app-flag',
      plural: 'app-flags',
      schema: {
        type: 'object',
        properties: {
          gift_cards__enabled: { type: 'string' },
          gift_cards__enabled_tags: { type: 'string' },
        },
      },
    });
    await call(t.engine, 'POST', '/app-flags', {
      token: t.adminToken,
      body: { gift_cards__enabled: 'tagged', gift_cards__enabled_tags: 'vip' },
    });

    const fresh = new AccessStore(t.engine.db, 0);
    expect(fresh.visibility('gift-cards', 'all')).toEqual({
      vis: 'tagged',
      enabledTags: 'vip',
    });

    // With a long TTL the first read is cached: a flag change isn't seen.
    const cached = new AccessStore(t.engine.db, 60_000);
    expect(cached.visibility('gift-cards', 'all').vis).toBe('tagged');
    t.engine.db.run(`UPDATE app_flags SET gift_cards__enabled = 'none'`);
    expect(cached.visibility('gift-cards', 'all').vis).toBe('tagged'); // stale
    expect(new AccessStore(t.engine.db, 0).visibility('gift-cards', 'all').vis).toBe('none');
  });

  test('userTags reads account_tags by user_id', async () => {
    await defineResource(t, {
      singular: 'account-tag',
      plural: 'account-tags',
      parents: ['user'],
      schema: { type: 'object', properties: { name: { type: 'string' } } },
    });
    await call(t.engine, 'POST', `/users/${t.admin.id}/account-tags`, {
      token: t.adminToken,
      body: { name: 'vip' },
    });
    const store = new AccessStore(t.engine.db, 0);
    expect(store.userTags(t.admin.id)).toEqual(['vip']);
    expect(store.userTags('nobody')).toEqual([]);
  });
});

describe('end-to-end gating through the engine', () => {
  let t: TestEngine;

  beforeEach(async () => {
    t = await makeEngine();
    await defineResource(t, {
      singular: 'gift-card',
      plural: 'gift-cards',
      schema: { type: 'object', properties: { merchant: { type: 'string' } } },
    });
    await defineResource(t, {
      singular: 'app-flag',
      plural: 'app-flags',
      schema: {
        type: 'object',
        properties: { gift_cards__enabled: { type: 'string' } },
      },
    });
    t.engine.setAccessCheck(
      makeAccessCheck(
        t.engine.db,
        {
          collectionToApp: { 'gift-cards': 'gift-cards' },
          appDefaults: { 'gift-cards': 'all' },
        },
        0, // fresh reads so flag changes apply immediately
      ),
    );
  });

  test('default visibility admits regular users; ungated collections unaffected', async () => {
    const u = await seedUser(t.engine, { email: 'u@example.com' });
    const ok = await call(t.engine, 'GET', '/gift-cards', { token: u.token });
    expect(ok.status).toBe(200);
    const me = await call(t.engine, 'GET', '/users/me', { token: u.token });
    expect(me.status).toBe(200);
  });

  test('superusers-only flag gates regular users but not superusers', async () => {
    await call(t.engine, 'POST', '/app-flags', {
      token: t.adminToken,
      body: { gift_cards__enabled: 'superusers' },
    });
    const u = await seedUser(t.engine, { email: 'u@example.com' });
    const denied = await call(t.engine, 'GET', '/gift-cards', { token: u.token });
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.message).toBe('you do not have access to this app');

    const admin = await call(t.engine, 'GET', '/gift-cards', { token: t.adminToken });
    expect(admin.status).toBe(200);
  });

  test('none denies even superusers; child paths inherit the gate', async () => {
    await call(t.engine, 'POST', '/app-flags', {
      token: t.adminToken,
      body: { gift_cards__enabled: 'none' },
    });
    const denied = await call(t.engine, 'GET', '/gift-cards', { token: t.adminToken });
    expect(denied.status).toBe(403);
    const child = await call(t.engine, 'GET', '/gift-cards/abc/transactions', {
      token: t.adminToken,
    });
    expect(child.status).toBe(403); // gated before routing, like the Go middleware
  });
});
