/**
 * Stage 2 — first-party session routes (/api/auth/{login,refresh,logout}).
 * Drives the Hono route group against a real in-memory engine db + AuthService.
 */

import { describe, expect, test, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { Database } from '../../src/engine/sqlite';
import { generateId, nowRFC3339 } from '../../src/engine/ids';
import { createUserTables, hashPassword, insertUser } from '../../src/engine/users';
import type { User } from '../../src/engine/types';
import { TYPE_REGULAR } from '../../src/engine/types';
import { AuthService } from '../../src/auth/service';
import { makeAuthRoutes } from '../../src/routes/auth';

const PASSWORD = 'correct horse battery';

interface Harness {
  app: Hono;
  auth: AuthService;
  user: User;
}

async function harness(): Promise<Harness> {
  const db = new Database(':memory:');
  createUserTables(db);
  const auth = new AuthService(db);
  const app = new Hono();
  app.route('/api/auth', makeAuthRoutes(db, auth));

  const id = generateId();
  const now = nowRFC3339();
  const user: User = {
    id,
    path: `users/${id}`,
    email: 'member@example.com',
    type: TYPE_REGULAR,
    create_time: now,
    update_time: now,
  };
  insertUser(db, user, await hashPassword(PASSWORD));
  return { app, auth, user };
}

function post(app: Hono, path: string, body?: unknown, token?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return Promise.resolve(
    app.request(path, {
      method: 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

describe('POST /api/auth/login', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await harness();
  });

  test('valid credentials return a session that validates', async () => {
    const res = await post(h.app, '/api/auth/login', {
      email: 'member@example.com',
      password: PASSWORD,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      user: { id: string; email: string };
    };
    expect(body.access_token).toBeTruthy();
    expect(body.refresh_token).toBeTruthy();
    expect(body.expires_in).toBeGreaterThan(0);
    expect(body.user.email).toBe('member@example.com');
    expect(h.auth.validateAccessToken(body.access_token)?.id).toBe(h.user.id);
  });

  test('a wrong password is 401', async () => {
    const res = await post(h.app, '/api/auth/login', {
      email: 'member@example.com',
      password: 'nope',
    });
    expect(res.status).toBe(401);
  });

  test('an unknown email is 401 (same message as a wrong password)', async () => {
    const res = await post(h.app, '/api/auth/login', {
      email: 'ghost@example.com',
      password: PASSWORD,
    });
    expect(res.status).toBe(401);
  });

  test('missing fields are 400', async () => {
    const res = await post(h.app, '/api/auth/login', { email: 'member@example.com' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/refresh', () => {
  test('rotates the session and single-uses the old refresh token', async () => {
    const h = await harness();
    const login = (await (
      await post(h.app, '/api/auth/login', { email: 'member@example.com', password: PASSWORD })
    ).json()) as { access_token: string; refresh_token: string };

    const res = await post(h.app, '/api/auth/refresh', { refresh_token: login.refresh_token });
    expect(res.status).toBe(200);
    const rotated = (await res.json()) as { access_token: string; refresh_token: string };
    expect(rotated.access_token).not.toBe(login.access_token);

    // New token works; old access token is revoked; old refresh can't be reused.
    expect(h.auth.validateAccessToken(rotated.access_token)?.id).toBe(h.user.id);
    expect(h.auth.validateAccessToken(login.access_token)).toBeNull();
    const reuse = await post(h.app, '/api/auth/refresh', { refresh_token: login.refresh_token });
    expect(reuse.status).toBe(401);
  });

  test('an unknown refresh token is 401', async () => {
    const h = await harness();
    const res = await post(h.app, '/api/auth/refresh', { refresh_token: 'bogus' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  test('revokes the presented access token and its refresh token', async () => {
    const h = await harness();
    const login = (await (
      await post(h.app, '/api/auth/login', { email: 'member@example.com', password: PASSWORD })
    ).json()) as { access_token: string; refresh_token: string };

    const res = await post(h.app, '/api/auth/logout', undefined, login.access_token);
    expect(res.status).toBe(200);
    expect(h.auth.validateAccessToken(login.access_token)).toBeNull();
    const reuse = await post(h.app, '/api/auth/refresh', { refresh_token: login.refresh_token });
    expect(reuse.status).toBe(401);
  });
});
