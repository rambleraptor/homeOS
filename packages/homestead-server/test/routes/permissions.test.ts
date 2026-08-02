/**
 * `/api/permissions` route guards. Auth is injected (the real `authenticate`
 * hits loopback), so these test the routing + the superuser gate on
 * `GET /user/:id` without a live auth backend.
 */

import { describe, expect, test } from 'vitest';
import type { AuthResult } from '@rambleraptor/homestead-core/server/aepbase';
import { makePermissionsRoute } from '../../src/routes/permissions';
import { makeEngine } from '../engine/helpers';

function asUser(id: string, type?: string): AuthResult {
  return {
    token: 't',
    user: { id, path: `users/${id}`, email: `${id}@example.com`, type },
  };
}

async function routeWith(auth: AuthResult | null) {
  const { engine } = await makeEngine();
  return makePermissionsRoute(engine, async () => auth);
}

describe('GET /api/permissions/user/:id', () => {
  test('401 when unauthenticated', async () => {
    const app = await routeWith(null);
    const res = await app.request('/user/u1');
    expect(res.status).toBe(401);
  });

  test('403 for a regular (non-superuser) caller', async () => {
    const app = await routeWith(asUser('regular', 'regular'));
    const res = await app.request('/user/u1');
    expect(res.status).toBe(403);
  });

  test('200 with the resolved context for a superuser caller', async () => {
    const app = await routeWith(asUser('admin', 'superuser'));
    const res = await app.request('/user/u1');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { enforced: boolean; groupIds: string[]; grants: unknown[] };
    expect(body).toHaveProperty('enforced');
    expect(body).toHaveProperty('groupIds');
    expect(Array.isArray(body.grants)).toBe(true);
  });
});

describe('GET /api/permissions/me', () => {
  test('returns the caller‘s own context', async () => {
    const app = await routeWith(asUser('me', 'regular'));
    const res = await app.request('/me');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { enforced: boolean };
    expect(body).toHaveProperty('enforced');
  });

  test('401 when unauthenticated', async () => {
    const app = await routeWith(null);
    const res = await app.request('/me');
    expect(res.status).toBe(401);
  });
});
