import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { buildProviders, type OAuthConfig } from '../../src/engine/oauth';
import { Engine } from '../../src/engine/engine';
import { listen, type Listener } from '../../src/listen';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedUser } from './helpers';

/** Port of aepbase/oauth_test.go — provider config validation. */
describe('buildProviders', () => {
  const base: OAuthConfig = {
    redirectBaseUrl: 'https://home.example.com/',
    successRedirect: 'https://home.example.com/auth/callback',
    providers: [
      {
        name: 'google',
        displayName: 'Google',
        clientId: 'cid',
        clientSecret: 'secret',
        scopes: ['openid', 'email'],
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
        allowRegistration: true,
      },
    ],
  };

  test('composes redirect URLs from the base (trailing slash trimmed)', () => {
    const [p] = buildProviders(base);
    expect(p!.redirectUrl).toBe('https://home.example.com/oauth/google/callback');
    expect(p!.successRedirectUrl).toBe('https://home.example.com/auth/callback');
    expect(p!.displayName).toBe('Google');
  });

  test('displayName falls back to name', () => {
    const cfg = structuredClone(base);
    delete cfg.providers[0]!.displayName;
    expect(buildProviders(cfg)[0]!.displayName).toBe('google');
  });

  test('null/empty config disables oauth', () => {
    expect(buildProviders(null)).toEqual([]);
    expect(buildProviders(undefined)).toEqual([]);
    expect(buildProviders({ ...base, providers: [] })).toEqual([]);
  });

  test('required fields are enforced', () => {
    for (const breakIt of [
      (c: OAuthConfig) => (c.redirectBaseUrl = ''),
      (c: OAuthConfig) => (c.successRedirect = ''),
      (c: OAuthConfig) => (c.providers[0]!.name = ''),
      (c: OAuthConfig) => (c.providers[0]!.clientId = ''),
      (c: OAuthConfig) => (c.providers[0]!.clientSecret = ''),
      (c: OAuthConfig) => (c.providers[0]!.authUrl = ''),
      (c: OAuthConfig) => (c.providers[0]!.tokenUrl = ''),
      (c: OAuthConfig) => (c.providers[0]!.userInfoUrl = ''),
    ]) {
      const cfg = structuredClone(base);
      breakIt(cfg);
      expect(() => buildProviders(cfg)).toThrow();
    }
  });
});

describe('oauth flow (mocked provider)', () => {
  let fakeProvider: Listener;
  let engine: Engine;
  let providerUrl: string;

  beforeAll(async () => {
    fakeProvider = await listen({
      port: 0,
      fetch: async (req) => {
        const url = new URL(req.url);
        if (url.pathname === '/token') {
          return Response.json({ access_token: 'provider-access-token' });
        }
        if (url.pathname === '/userinfo') {
          if (req.headers.get('authorization') !== 'Bearer provider-access-token') {
            return new Response('bad token', { status: 401 });
          }
          return Response.json({
            sub: 'prov-user-1',
            email: 'oauth-user@example.com',
            name: 'OAuth User',
          });
        }
        return new Response('nope', { status: 404 });
      },
    });
    providerUrl = `http://127.0.0.1:${fakeProvider.port}`;

    const dir = mkdtempSync(join(tmpdir(), 'hs-oauth-'));
    engine = new Engine({
      dbPath: ':memory:',
      filesDir: join(dir, 'files'),
      serverUrl: 'http://localhost:8090',
      oauth: {
        redirectBaseUrl: 'http://localhost:8090',
        successRedirect: 'http://localhost:3000/auth/callback',
        providers: [
          {
            name: 'fake',
            clientId: 'cid',
            clientSecret: 'csecret',
            authUrl: `${providerUrl}/auth`,
            tokenUrl: `${providerUrl}/token`,
            userInfoUrl: `${providerUrl}/userinfo`,
            allowRegistration: true,
          },
        ],
      },
    });
  });

  afterAll(async () => {
    await fakeProvider.stop();
  });

  const get = (path: string, headers: Record<string, string> = {}) =>
    engine.fetch(new Request(`http://localhost:8090${path}`, { headers }));

  test('GET /oauth/providers lists providers without secrets', async () => {
    const res = await get('/oauth/providers');
    const body = await res.json();
    expect(body.providers).toEqual([{ name: 'fake', display_name: 'fake' }]);
  });

  test('start sets the CSRF cookie and redirects to the provider', async () => {
    const res = await get('/oauth/fake/start');
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('location')!);
    expect(location.origin + location.pathname).toBe(`${providerUrl}/auth`);
    expect(location.searchParams.get('client_id')).toBe('cid');
    expect(location.searchParams.get('redirect_uri')).toBe(
      'http://localhost:8090/oauth/fake/callback',
    );
    expect(res.headers.get('set-cookie')).toContain('aepbase_oauth_state=');
    // The cookie must be scoped to the callback's directory (derived from the
    // redirect URL) so it is sent back on /callback — not a hardcoded path that
    // breaks under a mount prefix like /api/aep.
    expect(res.headers.get('set-cookie')).toContain('Path=/oauth/fake/');
  });

  test('callback exchanges the code, registers the user, redirects with #token', async () => {
    const start = await get('/oauth/fake/start');
    const state = new URL(start.headers.get('location')!).searchParams.get('state')!;
    const cookie = start.headers.get('set-cookie')!.split(';')[0]!;

    const cb = await get(`/oauth/fake/callback?code=abc&state=${state}`, { Cookie: cookie });
    expect(cb.status).toBe(302);
    const location = cb.headers.get('location')!;
    expect(location.startsWith('http://localhost:3000/auth/callback#token=')).toBe(true);
    const token = new URLSearchParams(location.split('#')[1]).get('token')!;

    // The minted token resolves the new user via /users/me.
    const me = await engine.fetch(
      new Request('http://localhost:8090/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    const user = await me.json();
    expect(user.email).toBe('oauth-user@example.com');
    expect(user.type).toBe('regular');

    // Second login reuses the linked identity instead of creating a new user.
    const start2 = await get('/oauth/fake/start');
    const state2 = new URL(start2.headers.get('location')!).searchParams.get('state')!;
    const cookie2 = start2.headers.get('set-cookie')!.split(';')[0]!;
    const cb2 = await get(`/oauth/fake/callback?code=xyz&state=${state2}`, { Cookie: cookie2 });
    const token2 = new URLSearchParams(cb2.headers.get('location')!.split('#')[1]).get('token')!;
    const me2 = await (
      await engine.fetch(
        new Request('http://localhost:8090/users/me', {
          headers: { Authorization: `Bearer ${token2}` },
        }),
      )
    ).json();
    expect(me2.id).toBe(user.id);
  });

  test('state mismatch and missing cookie are rejected', async () => {
    const start = await get('/oauth/fake/start');
    const cookie = start.headers.get('set-cookie')!.split(';')[0]!;

    const noCookie = await get('/oauth/fake/callback?code=abc&state=whatever');
    expect(noCookie.status).toBe(400);
    expect((await noCookie.json()).error.message).toContain('missing oauth state cookie');

    const mismatch = await get('/oauth/fake/callback?code=abc&state=wrong', { Cookie: cookie });
    expect(mismatch.status).toBe(400);
    expect((await mismatch.json()).error.message).toBe('oauth state mismatch');
  });

  test('oauth-created users cannot password-login (sentinel hash)', async () => {
    const res = await engine.fetch(
      new Request('http://localhost:8090/users/:login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'oauth-user@example.com', password: '!' }),
      }),
    );
    expect(res.status).toBe(401);
  });

  test('email match links the identity to an existing user', async () => {
    const existing = await seedUser(engine, { email: 'linked@example.com' });
    // New provider identity, same email → link, don't create.
    await fakeProvider.stop();
    fakeProvider = await listen({
      port: 0,
      fetch: async (req) => {
        const url = new URL(req.url);
        if (url.pathname === '/token') return Response.json({ access_token: 't' });
        if (url.pathname === '/userinfo') {
          return Response.json({ sub: 'prov-user-2', email: 'linked@example.com' });
        }
        return new Response('nope', { status: 404 });
      },
    });
    // Rebuild engine pointing at the new fake provider port.
    const dir = mkdtempSync(join(tmpdir(), 'hs-oauth2-'));
    const engine2 = new Engine({
      dbPath: ':memory:',
      filesDir: join(dir, 'files'),
      serverUrl: 'http://localhost:8090',
      oauth: {
        redirectBaseUrl: 'http://localhost:8090',
        successRedirect: 'http://localhost:3000/cb',
        providers: [
          {
            name: 'fake',
            clientId: 'c',
            clientSecret: 's',
            authUrl: `http://127.0.0.1:${fakeProvider.port}/auth`,
            tokenUrl: `http://127.0.0.1:${fakeProvider.port}/token`,
            userInfoUrl: `http://127.0.0.1:${fakeProvider.port}/userinfo`,
            allowRegistration: false, // linking works even with registration off
          },
        ],
      },
    });
    const linked = await seedUser(engine2, { email: 'linked@example.com' });
    void existing;

    const start = await engine2.fetch(new Request('http://localhost:8090/oauth/fake/start'));
    const state = new URL(start.headers.get('location')!).searchParams.get('state')!;
    const cookie = start.headers.get('set-cookie')!.split(';')[0]!;
    const cb = await engine2.fetch(
      new Request(`http://localhost:8090/oauth/fake/callback?code=c&state=${state}`, {
        headers: { Cookie: cookie },
      }),
    );
    expect(cb.status).toBe(302);
    const token = new URLSearchParams(cb.headers.get('location')!.split('#')[1]).get('token')!;
    const me = await (
      await engine2.fetch(
        new Request('http://localhost:8090/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      )
    ).json();
    expect(me.id).toBe(linked.user.id);
  });
});
