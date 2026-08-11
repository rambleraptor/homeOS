/**
 * `/api/tokens` (personal access tokens) route guards. Auth is injected so
 * these exercise request validation without a live auth backend. The
 * malformed-expiry check returns before any engine/serverClient interaction,
 * so a real-but-untouched engine is enough.
 */

import { describe, expect, test } from 'vitest';
import type { AuthResult } from '@rambleraptor/homestead-core/server/aepbase';
import { makeTokensRoute } from '../../src/routes/tokens';
import { makeEngine } from '../engine/helpers';

function asUser(id: string): AuthResult {
  return { token: 't', user: { id, path: `users/${id}`, email: `${id}@example.com` } };
}

async function routeWith(auth: AuthResult | null) {
  const { engine } = await makeEngine();
  return makeTokensRoute(engine, async () => auth);
}

function post(body: unknown): Request {
  return new Request('http://localhost/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/tokens — expires_at validation', () => {
  test('401 when unauthenticated', async () => {
    const app = await routeWith(null);
    const res = await app.request(post({ name: 'ci' }));
    expect(res.status).toBe(401);
  });

  test('400 on a malformed expires_at instead of a permanent token', async () => {
    const app = await routeWith(asUser('u1'));
    const res = await app.request(post({ name: 'ci', expires_at: 'not-a-date' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('expires_at');
  });

  test('400 when expires_at is present but not a string', async () => {
    const app = await routeWith(asUser('u1'));
    const res = await app.request(post({ name: 'ci', expires_at: 1893456000 }));
    expect(res.status).toBe(400);
  });
});
