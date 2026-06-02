/**
 * Unit tests for the OAuth client helpers in api/aepbase.ts.
 *
 * The global test setup mocks the aepbase module, so we pull the *real*
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

  it('completeOAuthLogin resolves the user via whoami and persists the token', async () => {
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

    const user = await actual.completeOAuthLogin('tok-123');

    expect(user.email).toBe('a@b.com');
    expect(user.type).toBe('regular');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe('/api/aep/users/me');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
    expect(actual.aepbase.authStore.token).toBe('tok-123');
  });

  it('completeOAuthLogin throws an AepbaseError on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: { message: 'forbidden' } }, 403)),
    );
    await expect(actual.completeOAuthLogin('t')).rejects.toThrow('forbidden');
  });
});
