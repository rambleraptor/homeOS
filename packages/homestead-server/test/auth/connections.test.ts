/**
 * Connected apps route (`/api/connections`): listing the OAuth clients a user
 * has authorized (one entry per client, sessions folded together, lapsed ones
 * dropped) and disconnecting one (revokes every token that client holds for the
 * caller, scoped so users can't touch each other's authorizations).
 */

import { describe, expect, test, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { Database } from '../../src/engine/sqlite';
import { generateId, nowRFC3339 } from '../../src/engine/ids';
import { createUserTables, insertUser, getTokenRecord } from '../../src/engine/users';
import type { User } from '../../src/engine/types';
import { TYPE_REGULAR } from '../../src/engine/types';
import { AuthService } from '../../src/auth/service';
import { createOAuthTables, insertClient } from '../../src/auth/oauth/storage';
import { makeConnectionsRoute, type AuthFn } from '../../src/routes/connections';
import type { Engine } from '../../src/engine/engine';

interface Harness {
  db: Database;
  auth: AuthService;
  app: Hono;
  alice: User;
  bob: User;
}

/** A test authFn: `Authorization: Bearer <userId>` resolves straight to that user. */
const authFn: AuthFn = async (req) => {
  const header = req.headers.get('authorization');
  const id = header?.replace(/^Bearer\s+/i, '').trim();
  if (!id) return null;
  return { token: id, user: { id } as never };
};

function makeUser(db: Database, email: string): User {
  const id = generateId();
  const now = nowRFC3339();
  const user: User = {
    id,
    path: `users/${id}`,
    email,
    type: TYPE_REGULAR,
    create_time: now,
    update_time: now,
  };
  insertUser(db, user, 'x');
  return user;
}

function harness(): Harness {
  const db = new Database(':memory:');
  createUserTables(db);
  createOAuthTables(db);
  const auth = new AuthService(db);
  const app = new Hono();
  app.route('/api/connections', makeConnectionsRoute({ db } as unknown as Engine, authFn));
  const alice = makeUser(db, 'alice@example.com');
  const bob = makeUser(db, 'bob@example.com');
  return { db, auth, app, alice, bob };
}

function list(app: Hono, userId: string) {
  return app.request('/api/connections', { headers: { Authorization: `Bearer ${userId}` } });
}

function disconnect(app: Hono, userId: string, clientId: string) {
  return app.request(`/api/connections/${clientId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${userId}` },
  });
}

describe('connections route', () => {
  let h: Harness;
  beforeEach(() => {
    h = harness();
  });

  test('lists nothing before any app is authorized', async () => {
    const res = await list(h.app, h.alice.id);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ apps: [] });
  });

  test('requires authentication', async () => {
    const res = await h.app.request('/api/connections');
    expect(res.status).toBe(401);
  });

  test('ignores the user’s own login sessions (no OAuth client)', async () => {
    // A plain login mints a refresh token with no client_id — not a connected app.
    h.auth.issueSession(h.alice.id);
    const res = await list(h.app, h.alice.id);
    expect(await res.json()).toEqual({ apps: [] });
  });

  test('folds a client’s sessions into one entry with its display name', async () => {
    insertClient(h.db, {
      client_id: 'client-a',
      client_secret: null,
      redirect_uris: ['https://a.example/cb'],
      client_name: 'Claude MCP',
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code'],
    });
    h.auth.issueSession(h.alice.id, { clientId: 'client-a', scope: 'homestead:read' });
    h.auth.issueSession(h.alice.id, { clientId: 'client-a', scope: 'homestead:read' });

    const res = await list(h.app, h.alice.id);
    const { apps } = (await res.json()) as { apps: Array<Record<string, unknown>> };
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({
      client_id: 'client-a',
      client_name: 'Claude MCP',
      scope: 'homestead:read',
      session_count: 2,
    });
  });

  test('separates distinct clients and isolates users', async () => {
    h.auth.issueSession(h.alice.id, { clientId: 'client-a' });
    h.auth.issueSession(h.alice.id, { clientId: 'client-b' });
    h.auth.issueSession(h.bob.id, { clientId: 'client-c' });

    const aliceApps = ((await (await list(h.app, h.alice.id)).json()) as { apps: unknown[] }).apps;
    expect(aliceApps).toHaveLength(2);
    const bobApps = ((await (await list(h.app, h.bob.id)).json()) as {
      apps: Array<{ client_id: string }>;
    }).apps;
    expect(bobApps.map((a) => a.client_id)).toEqual(['client-c']);
  });

  test('disconnect revokes every session for that client and invalidates its tokens', async () => {
    const s1 = h.auth.issueSession(h.alice.id, { clientId: 'client-a' });
    const s2 = h.auth.issueSession(h.alice.id, { clientId: 'client-a' });
    // A second client stays untouched.
    const other = h.auth.issueSession(h.alice.id, { clientId: 'client-b' });

    const res = await disconnect(h.app, h.alice.id, 'client-a');
    expect(res.status).toBe(200);

    // Both client-a access tokens are gone from the engine's token store.
    expect(getTokenRecord(h.db, s1.access_token)).toBeNull();
    expect(getTokenRecord(h.db, s2.access_token)).toBeNull();
    // The other client's token still validates.
    expect(getTokenRecord(h.db, other.access_token)).not.toBeNull();

    const apps = ((await (await list(h.app, h.alice.id)).json()) as {
      apps: Array<{ client_id: string }>;
    }).apps;
    expect(apps.map((a) => a.client_id)).toEqual(['client-b']);
  });

  test('disconnecting an unknown client is a 404', async () => {
    const res = await disconnect(h.app, h.alice.id, 'nope');
    expect(res.status).toBe(404);
  });

  test('one user cannot disconnect another user’s app', async () => {
    h.auth.issueSession(h.bob.id, { clientId: 'client-c' });
    const res = await disconnect(h.app, h.alice.id, 'client-c');
    expect(res.status).toBe(404);
    // Bob's session survives.
    const bobApps = ((await (await list(h.app, h.bob.id)).json()) as { apps: unknown[] }).apps;
    expect(bobApps).toHaveLength(1);
  });
});
