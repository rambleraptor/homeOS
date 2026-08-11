/**
 * Stage 2 — the federated OAuth callback issues a full session through the
 * injected issuer and widens the success-redirect fragment. Uses a manual
 * global.fetch stub (no vi.stubGlobal) so it runs under both Bun and Node.
 */

import { describe, expect, test } from 'vitest';
import { Database } from '../../src/engine/sqlite';
import { createUserTables } from '../../src/engine/users';
import { OAuthRoutes, type SessionIssuer } from '../../src/engine/oauth';

const OAUTH_CONFIG = {
  redirectBaseUrl: 'https://home.example.com',
  successRedirect: 'https://home.example.com/auth/callback',
  providers: [
    {
      name: 'google',
      clientId: 'cid',
      clientSecret: 'secret',
      authUrl: 'https://idp.example/auth',
      tokenUrl: 'https://idp.example/token',
      userInfoUrl: 'https://idp.example/userinfo',
      allowRegistration: true,
    },
  ],
};

function stubIdpFetch(): () => void {
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === 'https://idp.example/token') {
      return new Response(JSON.stringify({ access_token: 'provider-token' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url === 'https://idp.example/userinfo') {
      return new Response(
        JSON.stringify({
          sub: 'sub-1',
          email: 'fed@example.com',
          name: 'Fed User',
          email_verified: true,
        }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }
    throw new Error(`unexpected fetch to ${url}`);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = orig;
  };
}

function callbackRequest(): Request {
  return new Request('https://home.example.com/oauth/google/callback?code=abc&state=st-1', {
    headers: { Cookie: 'aepbase_oauth_state=st-1' },
  });
}

function locationFragment(res: Response): URLSearchParams {
  const loc = res.headers.get('Location')!;
  return new URLSearchParams(loc.slice(loc.indexOf('#') + 1));
}

describe('federated OAuth callback', () => {
  test('with an issuer, the fragment carries a full session', async () => {
    const db = new Database(':memory:');
    createUserTables(db);
    const routes = OAuthRoutes.fromConfig(db, OAUTH_CONFIG)!;
    const issuer: SessionIssuer = () => ({
      access_token: 'ACCESS',
      refresh_token: 'REFRESH',
      expires_in: 3600,
    });

    const restore = stubIdpFetch();
    try {
      const res = await routes.handle(callbackRequest(), ['oauth', 'google', 'callback'], issuer);
      expect(res!.status).toBe(302);
      const frag = locationFragment(res!);
      expect(frag.get('access_token')).toBe('ACCESS');
      expect(frag.get('refresh_token')).toBe('REFRESH');
      expect(frag.get('expires_in')).toBe('3600');
      // Alias for older SPA builds.
      expect(frag.get('token')).toBe('ACCESS');
    } finally {
      restore();
    }
  });

  test('without an issuer, it falls back to a bare token', async () => {
    const db = new Database(':memory:');
    createUserTables(db);
    const routes = OAuthRoutes.fromConfig(db, OAUTH_CONFIG)!;

    const restore = stubIdpFetch();
    try {
      const res = await routes.handle(callbackRequest(), ['oauth', 'google', 'callback']);
      expect(res!.status).toBe(302);
      const frag = locationFragment(res!);
      expect(frag.get('token')).toBeTruthy();
      expect(frag.get('access_token')).toBeNull();
    } finally {
      restore();
    }
  });
});
