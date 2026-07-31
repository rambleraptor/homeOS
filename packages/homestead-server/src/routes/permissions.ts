/**
 * `GET /api/permissions/me` — the caller's permission context for the client
 * `can()` mirror: group ids + expanded grants, and whether enforcement is on.
 *
 * The client can't enumerate its own group memberships over REST (they're
 * nested under groups), so this one endpoint mirrors the engine's
 * PermissionStore.gatherFor. Server stays authoritative; this only feeds UX.
 */

import { Hono } from 'hono';
import { authenticate } from '@rambleraptor/homestead-core/server/aepbase';
import type { Engine } from '../engine/engine';

export function makePermissionsRoute(engine: Engine): Hono {
  const app = new Hono();

  app.get('/me', async (c) => {
    const auth = await authenticate(c.req.raw);
    if (!auth) return c.json({ error: 'authentication required' }, 401);
    return c.json(engine.permissionContext(auth.user.id));
  });

  return app;
}
