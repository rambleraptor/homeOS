/**
 * `/api/security/*` — read-only security posture for the superuser
 * "Homestead Information" page.
 *
 *   - `GET /status` — whether encryption-at-rest is enabled (a master key is
 *     configured, per `encryptionEnabled()`). Superuser only: instance
 *     configuration isn't something a regular user should be able to probe.
 *
 * The server stays authoritative for the actual encryption; this only feeds the
 * status panel so a superuser can see, in-app, whether the key is in place.
 */

import { Hono } from 'hono';
import { authenticate, type AuthResult } from '@rambleraptor/homestead-core/server/aepbase';
import { encryptionEnabled } from '../engine/crypto';

/** Auth resolver, injectable so the route can be tested without loopback auth. */
export type AuthFn = (request: Request) => Promise<AuthResult | null>;

export function makeSecurityRoute(authFn: AuthFn = authenticate): Hono {
  const app = new Hono();

  app.get('/status', async (c) => {
    const auth = await authFn(c.req.raw);
    if (!auth) return c.json({ error: 'authentication required' }, 401);
    if (auth.user.type !== 'superuser') {
      return c.json({ error: 'superuser required' }, 403);
    }
    return c.json({ encryptionEnabled: encryptionEnabled() });
  });

  return app;
}
