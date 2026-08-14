/**
 * `/api/connections/*` — connected OAuth apps (Homestead as authorization
 * server: MCP clients and any other app the user authorized through `/oauth2`).
 *
 *   - `GET /`            — list the clients the user has an active authorization
 *                          with (one entry per client, sessions folded together).
 *   - `DELETE /:clientId` — disconnect an app: revoke every access + refresh
 *                          token that client holds for the caller.
 *
 * This is the OAuth-client analogue of the PAT route (`/api/tokens`): the same
 * auth seam and the same shape (list from a settings card, revoke from a
 * confirm dialog), but the tokens are minted by the OAuth flow, not here. A
 * caller only ever sees and revokes their own authorizations — every query is
 * scoped to `auth.user.id`.
 */

import { Hono } from 'hono';
import { authenticate, type AuthResult } from '@rambleraptor/homestead-core/server/aepbase';
import type { Engine } from '../engine/engine';
import { listConnectedApps, revokeClientForUser, userHasClient } from '../auth/storage';

/** Auth resolver, injectable so the route can be tested without loopback auth. */
export type AuthFn = (request: Request) => Promise<AuthResult | null>;

export function makeConnectionsRoute(engine: Engine, authFn: AuthFn = authenticate): Hono {
  const app = new Hono();

  app.get('/', async (c) => {
    const auth = await authFn(c.req.raw);
    if (!auth) return c.json({ error: 'authentication required' }, 401);
    return c.json({ apps: listConnectedApps(engine.db, auth.user.id) });
  });

  app.delete('/:clientId', async (c) => {
    const auth = await authFn(c.req.raw);
    if (!auth) return c.json({ error: 'authentication required' }, 401);
    const clientId = c.req.param('clientId');

    // Scoped to the caller: an unknown (or another user's) client is a 404, not
    // a leak that the client id exists.
    if (!userHasClient(engine.db, auth.user.id, clientId)) {
      return c.json({ error: 'connected app not found' }, 404);
    }

    revokeClientForUser(engine.db, auth.user.id, clientId);
    return c.json({});
  });

  return app;
}
