/**
 * The account-tags → groups migration, end to end against a real engine.
 *
 * Scenario — a household predating the permissions system tagged users with
 * `account-tag` records to gate app access. This migration lifts each distinct
 * tag *name* into a `group` and each `(user, tag)` pair into a
 * `group-membership`, so those cohorts become addressable by access-grants.
 *
 * The handler under test is the real one an app ships
 * (`homestead-core/superuser/users/migrations/account-tags-to-groups.ts`); it
 * talks to the engine through the server-side aepbase helpers, which use global
 * `fetch` against `AEPBASE_URL`. The test routes that fetch at the in-process
 * engine (stripping the `/api/aep` prefix the gateway would peel off in prod).
 */

import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { runMigrations } from '../src/migrations';
import type { RegisteredMigration } from '@rambleraptor/homestead-core/apps/registry';
import accountTagsToGroups from '@rambleraptor/homestead-core/superuser/users/migrations/account-tags-to-groups';
import { call, defineResource, makeEngine, seedUser, type TestEngine } from './engine/helpers';

const silent = { info() {}, warn() {}, error() {} };

/** Route the server-aepbase helpers' global fetch at the in-process engine. */
function installEngineFetch(t: TestEngine): void {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input.toString();
    const url = new URL(raw);
    url.pathname = url.pathname.replace(/^\/api\/aep/, '');
    return t.engine.fetch(new Request(url.toString(), init));
  }) as typeof fetch;
}

/** The real migration handler, wrapped as the runner expects it. */
function accountTagsMigration(): RegisteredMigration {
  return {
    id: 'users-account-tags-to-groups',
    appId: 'users',
    load: async () => ({ default: accountTagsToGroups }),
  };
}

interface Listed<T> {
  results?: T[];
}
async function list<T>(t: TestEngine, path: string): Promise<T[]> {
  const res = await call(t.engine, 'GET', `${path}?max_page_size=200`, {
    token: t.adminToken,
  });
  expect(res.ok).toBe(true);
  return ((await res.json()) as Listed<T>).results ?? [];
}

describe('account-tags → groups migration', () => {
  let t: TestEngine;
  const origFetch = globalThis.fetch;

  beforeEach(async () => {
    t = await makeEngine();
    // The three collections the migration reads/writes, as the schema sync
    // would leave them.
    await defineResource(t, {
      singular: 'account-tag',
      plural: 'account-tags',
      parents: ['user'],
      superuser_write: true,
      schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    });
    await defineResource(t, {
      singular: 'group',
      plural: 'groups',
      superuser_write: true,
      schema: {
        type: 'object',
        properties: { name: { type: 'string' }, description: { type: 'string' } },
        required: ['name'],
      },
    });
    await defineResource(t, {
      singular: 'group-membership',
      plural: 'group-memberships',
      parents: ['group'],
      superuser_write: true,
      schema: {
        type: 'object',
        properties: { user: { type: 'string' }, role: { type: 'string' } },
        required: ['user'],
      },
    });
    installEngineFetch(t);
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  async function tag(userId: string, name: string): Promise<void> {
    const res = await call(t.engine, 'POST', `/users/${userId}/account-tags`, {
      token: t.adminToken,
      body: { name },
    });
    expect(res.ok).toBe(true);
  }

  test('creates one group per distinct tag and a membership per (user, tag), idempotently', async () => {
    const alice = (await seedUser(t.engine, { email: 'alice@example.com' })).user;
    const bob = (await seedUser(t.engine, { email: 'bob@example.com' })).user;

    // alice: adults + parents · bob: adults — "adults" is shared.
    await tag(alice.id, 'adults');
    await tag(alice.id, 'parents');
    await tag(bob.id, 'adults');

    const migration = accountTagsMigration();
    const first = await runMigrations(t.engine.db, {
      token: t.adminToken,
      migrations: [migration],
      logger: silent,
    });
    expect(first.ran).toEqual(['users-account-tags-to-groups']);

    // One group per distinct tag name.
    const groups = await list<{ id: string; name: string }>(t, '/groups');
    const byName = Object.fromEntries(groups.map((g) => [g.name, g.id]));
    expect(Object.keys(byName).sort()).toEqual(['adults', 'parents']);

    // "adults" has both users, "parents" only alice.
    const adultMembers = await list<{ user: string }>(
      t,
      `/groups/${byName.adults}/group-memberships`,
    );
    expect(adultMembers.map((m) => m.user).sort()).toEqual([alice.id, bob.id].sort());
    const parentMembers = await list<{ user: string }>(
      t,
      `/groups/${byName.parents}/group-memberships`,
    );
    expect(parentMembers.map((m) => m.user)).toEqual([alice.id]);

    // Ledger summary.
    const row = t.engine.db
      .query(`SELECT result FROM _homestead_migrations WHERE migration_id = ?`)
      .get('users-account-tags-to-groups') as { result: string };
    expect(JSON.parse(row.result)).toMatchObject({
      tagsScanned: 3,
      groupsCreated: 2,
      membershipsCreated: 3,
    });

    // Force a re-run (clear the ledger) — the guard makes it a no-op: no
    // duplicate groups or memberships.
    t.engine.db.run(`DELETE FROM _homestead_migrations`);
    const second = await runMigrations(t.engine.db, {
      token: t.adminToken,
      migrations: [migration],
      logger: silent,
    });
    expect(second.ran).toEqual(['users-account-tags-to-groups']);

    expect((await list<unknown>(t, '/groups')).length).toBe(2);
    expect(
      (await list<unknown>(t, `/groups/${byName.adults}/group-memberships`)).length,
    ).toBe(2);
    const rerun = t.engine.db
      .query(`SELECT result FROM _homestead_migrations WHERE migration_id = ?`)
      .get('users-account-tags-to-groups') as { result: string };
    expect(JSON.parse(rerun.result)).toMatchObject({
      groupsCreated: 0,
      membershipsCreated: 0,
    });
  });
});
