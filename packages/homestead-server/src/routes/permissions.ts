/**
 * `/api/permissions/*` — permission context for the client `can()` mirror and
 * the admin UI.
 *
 *   - `GET /me`        — the caller's own context (group ids + expanded grants,
 *                        and whether enforcement is live).
 *   - `GET /user/:id`  — another user's context, **superuser only**. Backs the
 *                        "what can this user access?" summary on the Users page.
 *
 * The client can't enumerate a user's group memberships over REST (they're
 * nested under groups), so these mirror the engine's PermissionStore.gatherFor.
 * The server stays authoritative; this only feeds UX.
 */

import { Hono } from 'hono';
import { authenticate, type AuthResult } from '@rambleraptor/homestead-core/server/aepbase';
import type { Engine } from '../engine/engine';

/** Auth resolver, injectable so the route can be tested without loopback auth. */
export type AuthFn = (request: Request) => Promise<AuthResult | null>;

export function makePermissionsRoute(engine: Engine, authFn: AuthFn = authenticate): Hono {
  const app = new Hono();

  app.get('/me', async (c) => {
    const auth = await authFn(c.req.raw);
    if (!auth) return c.json({ error: 'authentication required' }, 401);
    return c.json(engine.permissionContext(auth.user.id));
  });

  app.get('/user/:id', async (c) => {
    const auth = await authFn(c.req.raw);
    if (!auth) return c.json({ error: 'authentication required' }, 401);
    // Only a superuser may inspect another account's access — a regular user
    // must not be able to enumerate someone else's grants.
    if (auth.user.type !== 'superuser') {
      return c.json({ error: 'superuser required' }, 403);
    }
    return c.json(engine.permissionContext(c.req.param('id')));
  });

  return app;
}
