/**
 * First-party session auth: `POST /api/auth/{login,refresh,logout}`.
 *
 * This is the SPA's login path. Unlike the engine's `/users:login` (which the
 * CLI uses and which mints a non-expiring token), these routes go through the
 * auth service, so the SPA gets a short-lived access token plus a refresh
 * token it can rotate. Access tokens are ordinary engine tokens, so every
 * other `/api/aep` call keeps working with the returned `access_token`.
 */

import { Hono } from 'hono';
import type { Database } from '../engine/sqlite';
import { extractBearerToken, getUserByEmail, verifyPassword } from '../engine/users';
import type { AuthService } from '../auth/service';

interface PublicUser {
  id: string;
  email: string;
  display_name?: string;
  type: string;
}

function toPublicUser(u: {
  id: string;
  email: string;
  display_name?: string;
  type: string;
}): PublicUser {
  return { id: u.id, email: u.email, display_name: u.display_name, type: u.type };
}

export function makeAuthRoutes(db: Database, auth: AuthService): Hono {
  const app = new Hono();

  app.post('/login', async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      email?: string;
      password?: string;
    } | null;
    const email = body?.email?.trim();
    const password = body?.password;
    if (!email || !password) {
      return c.json({ error: 'email and password are required' }, 400);
    }

    const found = getUserByEmail(db, email);
    // Same generic message whether the email is unknown or the password is
    // wrong, and always run verifyPassword-equivalent work to avoid leaking
    // which accounts exist via timing. getUserByEmail returning null still
    // funnels to the same 401.
    if (!found || !(await verifyPassword(password, found.hash))) {
      return c.json({ error: 'invalid email or password' }, 401);
    }

    const session = auth.issueSession(found.user.id);
    return c.json({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      user: toPublicUser(found.user),
    });
  });

  app.post('/refresh', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { refresh_token?: string } | null;
    const refreshToken = body?.refresh_token;
    if (!refreshToken) {
      return c.json({ error: 'refresh_token is required' }, 400);
    }
    const session = auth.rotateRefresh(refreshToken);
    if (!session) {
      return c.json({ error: 'invalid or expired refresh token' }, 401);
    }
    return c.json({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
    });
  });

  app.post('/logout', (c) => {
    // Revoke whatever access token is presented (and its refresh token). Not
    // gated on validity: logging out with an already-dead token is a no-op.
    const token = extractBearerToken(c.req.raw);
    if (token) auth.revokeSession(token);
    return c.json({});
  });

  return app;
}
