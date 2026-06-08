/**
 * Unit tests for the custom-method dispatcher. Exercises the
 * parse → resolve → method-check → auth-check → load → invoke pipeline
 * (plus the aepbase passthrough fallback) with synthetic wiring so the
 * test stays isolated from the real resource registry.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  dispatchCustomMethod,
  parseCustomMethodPath,
} from '../dispatcher';
import type {
  CustomMethodAuth,
  CustomMethodHandler,
  ResourceCustomMethod,
} from '../../types';

const fakeAuth: CustomMethodAuth = {
  token: 'tok',
  user: { id: 'u1', path: '/users/u1', email: 'a@b.c' },
};

function makeRequest(method: string, body?: unknown): Request {
  return new Request('http://localhost/api/aep/grocery-items:process-image', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function makeMethod(
  handler: CustomMethodHandler,
  overrides: Partial<ResourceCustomMethod> = {},
): ResourceCustomMethod {
  return {
    target: 'collection',
    method: 'POST',
    load: async () => ({ default: handler }),
    ...overrides,
  };
}

const neverPassthrough = vi.fn(async () =>
  Response.json({ error: 'should not passthrough' }, { status: 599 }),
);

describe('parseCustomMethodPath', () => {
  it('parses a collection method', () => {
    expect(parseCustomMethodPath('/grocery-items:process-image')).toEqual({
      plural: 'grocery-items',
      target: 'collection',
      parent: [],
      verb: 'process-image',
    });
  });

  it('parses an item method, exposing the id', () => {
    expect(parseCustomMethodPath('/hsa-receipts/abc123:parse-receipt')).toEqual({
      plural: 'hsa-receipts',
      target: 'item',
      id: 'abc123',
      parent: [],
      verb: 'parse-receipt',
    });
  });

  it('parses a nested collection method, capturing the parent chain', () => {
    expect(
      parseCustomMethodPath('/gift-cards/g1/transactions:settle'),
    ).toEqual({
      plural: 'transactions',
      target: 'collection',
      parent: ['gift-cards', 'g1'],
      verb: 'settle',
    });
  });

  it('ignores a trailing query string', () => {
    expect(
      parseCustomMethodPath('/gift-cards/g1:download?field=front_image'),
    ).toMatchObject({ plural: 'gift-cards', target: 'item', verb: 'download' });
  });

  it('returns null when there is no colon verb', () => {
    expect(parseCustomMethodPath('/grocery-items')).toBeNull();
    expect(parseCustomMethodPath('/grocery-items/abc')).toBeNull();
  });

  it('returns null when the colon is not in the final segment', () => {
    expect(parseCustomMethodPath('/users/:login/extra')).toBeNull();
  });
});

describe('dispatchCustomMethod', () => {
  it('passes the request through to aepbase when no colon verb is present', async () => {
    const passthrough = vi.fn(async () => Response.json({ proxied: true }));
    const res = await dispatchCustomMethod({
      request: new Request('http://localhost/api/aep/grocery-items'),
      path: '/grocery-items',
      resolveMethod: () => undefined,
      authenticate: vi.fn(),
      passthrough,
    });
    expect(passthrough).toHaveBeenCalledOnce();
    expect(await res.json()).toEqual({ proxied: true });
  });

  it('passes through colon paths that are not registered methods (e.g. :download)', async () => {
    const passthrough = vi.fn(async () => Response.json({ proxied: true }));
    const res = await dispatchCustomMethod({
      request: makeRequest('POST'),
      path: '/gift-cards/g1:download',
      resolveMethod: () => undefined,
      authenticate: vi.fn(),
      passthrough,
    });
    expect(passthrough).toHaveBeenCalledOnce();
    expect(await res.json()).toEqual({ proxied: true });
  });

  it('passes through when the registered method targets a different scope', async () => {
    const passthrough = vi.fn(async () => Response.json({ proxied: true }));
    const handler = vi.fn();
    // Registered as an item method, but the path addresses a collection.
    await dispatchCustomMethod({
      request: makeRequest('POST'),
      path: '/grocery-items:process-image',
      resolveMethod: () => makeMethod(handler, { target: 'item' }),
      authenticate: vi.fn(),
      passthrough,
    });
    expect(passthrough).toHaveBeenCalledOnce();
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 405 with an Allow header when the method does not match', async () => {
    const handler = vi.fn();
    const res = await dispatchCustomMethod({
      request: makeRequest('GET'),
      path: '/grocery-items:process-image',
      resolveMethod: () => makeMethod(handler, { method: 'POST' }),
      authenticate: vi.fn(),
      passthrough: neverPassthrough,
    });
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST');
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated callers (custom methods always require auth)', async () => {
    const handler = vi.fn();
    const res = await dispatchCustomMethod({
      request: makeRequest('POST'),
      path: '/grocery-items:process-image',
      resolveMethod: () => makeMethod(handler),
      authenticate: async () => null,
      passthrough: neverPassthrough,
    });
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('passes auth + parsed address through to the handler', async () => {
    const handler = vi.fn(async ({ auth, plural, verb, target }) =>
      Response.json({ userId: auth.user.id, plural, verb, target }),
    );
    const res = await dispatchCustomMethod({
      request: makeRequest('POST'),
      path: '/grocery-items:process-image',
      resolveMethod: () => makeMethod(handler),
      authenticate: async () => fakeAuth,
      passthrough: neverPassthrough,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      userId: 'u1',
      plural: 'grocery-items',
      verb: 'process-image',
      target: 'collection',
    });
    expect(handler.mock.calls[0][0]).toMatchObject({ auth: fakeAuth });
  });

  it('exposes the addressed id for item-target methods', async () => {
    const handler = vi.fn(async ({ id }) => Response.json({ id }));
    const res = await dispatchCustomMethod({
      request: makeRequest('POST'),
      path: '/hsa-receipts/abc123:archive',
      resolveMethod: () => makeMethod(handler, { target: 'item' }),
      authenticate: async () => fakeAuth,
      passthrough: neverPassthrough,
    });
    expect(await res.json()).toEqual({ id: 'abc123' });
  });

  it('defaults the method to POST when none is declared', async () => {
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const resolveMethod = (): ResourceCustomMethod => ({
      load: async () => ({ default: handler }),
    });
    const ok = await dispatchCustomMethod({
      request: makeRequest('POST'),
      path: '/grocery-items:process-image',
      resolveMethod,
      authenticate: async () => fakeAuth,
      passthrough: neverPassthrough,
    });
    expect(ok.status).toBe(200);

    const wrong = await dispatchCustomMethod({
      request: makeRequest('GET'),
      path: '/grocery-items:process-image',
      resolveMethod,
      authenticate: async () => fakeAuth,
      passthrough: neverPassthrough,
    });
    expect(wrong.status).toBe(405);
  });

  it('returns 500 when the lazy import fails', async () => {
    const res = await dispatchCustomMethod({
      request: makeRequest('POST'),
      path: '/grocery-items:process-image',
      resolveMethod: () => ({
        load: async () => {
          throw new Error('boom');
        },
      }),
      authenticate: async () => fakeAuth,
      passthrough: neverPassthrough,
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'Internal server error' });
  });

  it('returns 500 when the handler throws, surfacing the message', async () => {
    const handler = vi.fn(async () => {
      throw new Error('handler exploded');
    });
    const res = await dispatchCustomMethod({
      request: makeRequest('POST'),
      path: '/grocery-items:process-image',
      resolveMethod: () => makeMethod(handler),
      authenticate: async () => fakeAuth,
      passthrough: neverPassthrough,
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({
      error: 'Internal server error',
      message: 'handler exploded',
    });
  });
});
