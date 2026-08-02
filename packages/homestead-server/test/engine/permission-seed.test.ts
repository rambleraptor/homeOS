/**
 * End-to-end (in-process) check that the real permission resource definitions
 * are accepted by the meta API and that the boot seeder creates the baseline
 * roles + open grant idempotently. Mirrors what schema-sync does at boot.
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { toWireSchema } from '@rambleraptor/homestead-core/resources/translate';
import { PERMISSION_RESOURCE_DEFS } from '@rambleraptor/homestead-core/permissions/resources';
import { seedPermissions } from '@rambleraptor/homestead-core/permissions/seed';
import { call, defineResource, makeEngine, type TestEngine } from './helpers';

const BASE = 'http://localhost:8090';

async function defineAll(t: TestEngine): Promise<void> {
  for (const def of PERMISSION_RESOURCE_DEFS) {
    const res = await defineResource(
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
    expect(res.status, `define ${def.singular}`).toBeLessThan(300);
  }
}

async function listIds(t: TestEngine, plural: string): Promise<string[]> {
  const res = await call(t.engine, 'GET', `/${plural}`, { token: t.adminToken });
  const body = (await res.json()) as { results?: Array<{ id: string }> };
  return (body.results ?? []).map((r) => r.id).sort();
}

describe('permission resources + seed at boot', () => {
  let t: TestEngine;
  const fetchImpl = (input: string, init?: RequestInit) => t.engine.fetch(new Request(input, init));

  beforeEach(async () => {
    t = await makeEngine();
    await defineAll(t);
  });

  test('the real definitions are accepted by the meta API', async () => {
    // defineAll asserts each create succeeded; a follow-up GET confirms they route.
    const res = await call(t.engine, 'GET', '/roles', { token: t.adminToken });
    expect(res.status).toBe(200);
  });

  test('seeding creates admin/member/guest and the open grant', async () => {
    await seedPermissions(BASE, t.adminToken, fetchImpl);

    expect(await listIds(t, 'roles')).toEqual(['admin', 'guest', 'member']);
    expect(await listIds(t, 'access-grants')).toEqual(['open-household']);

    const member = await call(t.engine, 'GET', '/roles/member', { token: t.adminToken });
    expect((await member.json()).grants).toEqual([{ target_scope: 'all', capability: 'write' }]);

    const grant = await call(t.engine, 'GET', '/access-grants/open-household', {
      token: t.adminToken,
    });
    const g = await grant.json();
    expect(g.subject_type).toBe('everyone');
    expect(g.target_scope).toBe('all');
    expect(g.capability).toBe('write');
    // Marked as the suppressible fallback default (§8.x).
    expect(g.is_default).toBe(true);
  });

  test('backfills is_default on an open grant seeded before the flag existed', async () => {
    // Simulate an older deployment: an open-household grant with no is_default.
    await call(t.engine, 'POST', '/access-grants?id=open-household', {
      token: t.adminToken,
      body: { subject_type: 'everyone', target_scope: 'all', capability: 'write', effect: 'allow' },
    });
    const before = await (
      await call(t.engine, 'GET', '/access-grants/open-household', { token: t.adminToken })
    ).json();
    expect(before.is_default ?? false).toBe(false);

    // Seed runs the ensure step because the grant collection is non-empty.
    await seedPermissions(BASE, t.adminToken, fetchImpl);

    const after = await (
      await call(t.engine, 'GET', '/access-grants/open-household', { token: t.adminToken })
    ).json();
    expect(after.is_default).toBe(true);
  });

  test('seeding is idempotent (seed-when-empty)', async () => {
    await seedPermissions(BASE, t.adminToken, fetchImpl);
    await seedPermissions(BASE, t.adminToken, fetchImpl);
    expect(await listIds(t, 'roles')).toEqual(['admin', 'guest', 'member']);
    expect(await listIds(t, 'access-grants')).toEqual(['open-household']);
  });

  test('a tightened household is not re-seeded (roles left intact)', async () => {
    await seedPermissions(BASE, t.adminToken, fetchImpl);
    // Admin narrows: delete the open grant.
    await call(t.engine, 'DELETE', '/access-grants/open-household', { token: t.adminToken });
    // Add a bespoke grant so the collection is non-empty.
    await call(t.engine, 'POST', '/access-grants?id=custom', {
      token: t.adminToken,
      body: { subject_type: 'everyone', target_scope: 'app', target_app: 'recipes', capability: 'read' },
    });

    await seedPermissions(BASE, t.adminToken, fetchImpl);
    // The open grant is NOT resurrected (collection was non-empty).
    expect(await listIds(t, 'access-grants')).toEqual(['custom']);
  });
});
