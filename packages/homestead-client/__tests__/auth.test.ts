import { describe, it, expect, vi } from 'vitest';
import {
  createHomesteadClient,
  password,
  browserSession,
  OperationFailedError,
} from '../index';
import { mockFetch, jsonBody } from './helpers';

const RAW_USER = {
  id: 'u1',
  email: 'a@b.com',
  display_name: 'Ada',
  type: 'regular',
  create_time: '2026-01-01',
  update_time: '2026-01-02',
};

describe('auth.login', () => {
  it('exchanges credentials and maps the user', async () => {
    const mock = mockFetch(() => ({ json: { token: 'tok', user: RAW_USER } }));
    const hs = createHomesteadClient({ auth: browserSession(), fetch: mock.fetch });
    const user = await hs.auth.login('a@b.com', 'pw');
    expect(user).toMatchObject({ id: 'u1', name: 'Ada', type: 'regular' });
    expect(mock.calls[0].url).toBe('/api/aep/users/:login');
    expect(jsonBody(mock.calls[0])).toEqual({ email: 'a@b.com', password: 'pw' });
    // Session persisted → subsequent calls carry the token.
    await hs.collection('gift-cards').listAll().catch(() => {});
    const listCall = mock.calls.find((c) => c.url.includes('/gift-cards'))!;
    expect(listCall.headers.Authorization).toBe('Bearer tok');
  });
});

describe('password strategy', () => {
  it('logs in lazily and caches the token', async () => {
    let logins = 0;
    const mock = mockFetch((c) => {
      if (c.url.endsWith(':login')) {
        logins++;
        return { json: { token: 'lazy-tok', user: RAW_USER } };
      }
      return { json: { results: [] } };
    });
    const hs = createHomesteadClient({
      auth: password({ email: 'a@b.com', password: 'pw' }),
      fetch: mock.fetch,
    });
    // No login until the first authenticated call.
    expect(logins).toBe(0);
    await hs.collection('gift-cards').listAll();
    await hs.collection('gift-cards').listAll();
    expect(logins).toBe(1); // cached across calls
    const listCall = mock.calls.find((c) => c.url.includes('/gift-cards'))!;
    expect(listCall.headers.Authorization).toBe('Bearer lazy-tok');
  });
});

describe('browserSession', () => {
  it('emits on change and clears on logout', async () => {
    const mock = mockFetch((c) =>
      c.url.endsWith(':login')
        ? { json: { token: 'tok', user: RAW_USER } }
        : { status: 204 },
    );
    const auth = browserSession();
    const listener = vi.fn();
    auth.onChange(listener);
    const hs = createHomesteadClient({ auth, fetch: mock.fetch });

    await hs.auth.login('a@b.com', 'pw');
    expect(auth.currentUser()?.id).toBe('u1');
    expect(listener).toHaveBeenCalledWith('tok', expect.objectContaining({ id: 'u1' }));

    await hs.auth.logout();
    expect(auth.currentUser()).toBeNull();
    expect(listener).toHaveBeenLastCalledWith('', null);
  });

  it('clears the session on a 401', async () => {
    const auth = browserSession();
    auth.setSession('stale', { ...RAW_USER, name: 'Ada' } as never);
    const mock = mockFetch(() => ({ status: 401, json: { error: { message: 'nope' } } }));
    const hs = createHomesteadClient({ auth, fetch: mock.fetch });
    await hs.collection('gift-cards').get('x').catch(() => {});
    expect(auth.token()).toBeNull();
  });
});

describe('oauth', () => {
  it('lists providers and builds a start url', async () => {
    const mock = mockFetch(() => ({ json: { providers: [{ name: 'google', display_name: 'Google' }] } }));
    const hs = createHomesteadClient({ baseUrl: 'https://x', fetch: mock.fetch });
    expect(await hs.auth.oauth.providers()).toEqual([
      { name: 'google', display_name: 'Google' },
    ]);
    expect(hs.auth.oauth.startUrl('google')).toBe(
      'https://x/api/aep/oauth/google/start',
    );
  });
});

describe('operations', () => {
  it('polls until done and returns the response', async () => {
    const states = [
      { done: false },
      { done: true, response: { parsed: 42 } },
    ];
    let i = 0;
    const mock = mockFetch(() => ({ json: states[Math.min(i++, states.length - 1)] }));
    const hs = createHomesteadClient({ fetch: mock.fetch });
    const result = await hs.operations.await('op1', { intervalMs: 1 });
    expect(result).toEqual({ parsed: 42 });
  });

  it('throws OperationFailedError on an error payload', async () => {
    const mock = mockFetch(() => ({ json: { done: true, error: { message: 'boom' } } }));
    const hs = createHomesteadClient({ fetch: mock.fetch });
    await expect(hs.operations.await('op1', { intervalMs: 1 })).rejects.toBeInstanceOf(
      OperationFailedError,
    );
  });
});
