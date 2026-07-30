/**
 * Unit tests for the OAuth client helpers in api/aepbase.ts.
 *
 * The global test setup mocks the aepbase app, so we pull the *real*
 * implementation via importActual and drive it with a stubbed global fetch.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const actual = await vi.importActual<typeof import('../aepbase')>('../aepbase');

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('oauth client', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('listOAuthProviders parses the providers array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ providers: [{ name: 'google', display_name: 'Google' }] }),
      ),
    );
    expect(await actual.listOAuthProviders()).toEqual([
      { name: 'google', display_name: 'Google' },
    ]);
  });

  it('listOAuthProviders returns [] when the endpoint errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network');
      }),
    );
    expect(await actual.listOAuthProviders()).toEqual([]);
  });

  it('completeOAuthLogin resolves the user via whoami and persists the session', async () => {
    const userJson = {
      id: 'u1',
      path: 'users/u1',
      email: 'a@b.com',
      display_name: 'A',
      type: 'regular',
      create_time: 't',
      update_time: 't',
    };
    const fetchMock = vi.fn(async () => jsonResponse(userJson));
    vi.stubGlobal('fetch', fetchMock);

    const user = await actual.completeOAuthLogin({
      accessToken: 'tok-123',
      refreshToken: 'ref-123',
      expiresIn: 3600,
    });

    expect(user.email).toBe('a@b.com');
    expect(user.type).toBe('regular');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe('/api/aep/users/me');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
    expect(actual.aepbase.authStore.token).toBe('tok-123');
    expect(actual.aepbase.authStore.refreshToken).toBe('ref-123');
  });

  it('completeOAuthLogin throws an AepbaseError on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: { message: 'forbidden' } }, 403)),
    );
    await expect(actual.completeOAuthLogin({ accessToken: 't' })).rejects.toThrow('forbidden');
  });

  it('login posts to /api/auth/login and stores the session', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        access_token: 'acc-1',
        refresh_token: 'ref-1',
        expires_in: 3600,
        user: {
          id: 'u1',
          path: 'users/u1',
          email: 'a@b.com',
          type: 'regular',
          create_time: 't',
          update_time: 't',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const user = await actual.login('a@b.com', 'pw');
    expect(user.email).toBe('a@b.com');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/login');
    expect(actual.aepbase.authStore.token).toBe('acc-1');
    expect(actual.aepbase.authStore.refreshToken).toBe('ref-1');
  });

  it('refreshSession rotates tokens on success and clears on rejection', async () => {
    // Seed a session with a refresh token.
    actual.aepbase.authStore.saveSession(
      { accessToken: 'old-acc', refreshToken: 'old-ref', expiresIn: 3600 },
      null,
    );

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ access_token: 'new-acc', refresh_token: 'new-ref', expires_in: 3600 }),
      ),
    );
    expect(await actual.refreshSession()).toBe(true);
    expect(actual.aepbase.authStore.token).toBe('new-acc');
    expect(actual.aepbase.authStore.refreshToken).toBe('new-ref');

    // A rejected refresh clears the session.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'nope' }, 401)),
    );
    expect(await actual.refreshSession()).toBe(false);
    expect(actual.aepbase.authStore.isValid).toBe(false);
  });
});
