/**
 * `/api/security` route guards. Auth is injected (the real `authenticate` hits
 * loopback), so these test routing + the superuser gate without a live auth
 * backend. The default key-path fallback is disabled so `encryptionEnabled()`
 * is driven only by the env var we set here, not a key on the dev's machine.
 */

import { afterEach, describe, expect, test } from 'vitest';
import { randomBytes } from 'node:crypto';
import type { AuthResult } from '@rambleraptor/homestead-core/server/aepbase';
import { makeSecurityRoute } from '../../src/routes/security';
import {
  __resetMasterKeyCacheForTests,
  __setDefaultKeyPathForTests,
} from '../../src/engine/crypto';

function asUser(id: string, type?: string): AuthResult {
  return {
    token: 't',
    user: { id, path: `users/${id}`, email: `${id}@example.com`, type },
  };
}

function routeWith(auth: AuthResult | null) {
  return makeSecurityRoute(async () => auth);
}

afterEach(() => {
  delete process.env.HOMESTEAD_MASTER_KEY;
  __setDefaultKeyPathForTests(null);
});

describe('GET /api/security/status', () => {
  test('401 when unauthenticated', async () => {
    const res = await routeWith(null).request('/status');
    expect(res.status).toBe(401);
  });

  test('403 for a regular (non-superuser) caller', async () => {
    const res = await routeWith(asUser('regular', 'regular')).request('/status');
    expect(res.status).toBe(403);
  });

  test('reports encryptionEnabled=false with no key configured', async () => {
    delete process.env.HOMESTEAD_MASTER_KEY;
    __setDefaultKeyPathForTests(null); // ignore any ~/.homestead/master.key
    const res = await routeWith(asUser('admin', 'superuser')).request('/status');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ encryptionEnabled: false });
  });

  test('reports encryptionEnabled=true when a key is configured', async () => {
    process.env.HOMESTEAD_MASTER_KEY = randomBytes(32).toString('base64');
    __resetMasterKeyCacheForTests();
    const res = await routeWith(asUser('admin', 'superuser')).request('/status');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ encryptionEnabled: true });
  });
});
