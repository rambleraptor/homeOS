/**
 * Unit tests for the module worker dispatcher. Exercises the
 * lookup → method-check → auth-check → load → invoke pipeline
 * with a synthetic registry and authenticator so the test stays
 * isolated from the real module config.
 */

import { describe, it, expect, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { dispatchModuleWorker } from '../dispatcher';
import type {
  ModuleWorker,
  ModuleWorkerAuth,
  ModuleWorkerHandler,
} from '../../types';

const fakeAuth: ModuleWorkerAuth = {
  token: 'tok',
  user: { id: 'u1', path: '/users/u1', email: 'a@b.c' },
};

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/modules/m/w', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function makeWorker(
  handler: ModuleWorkerHandler,
  overrides: Partial<ModuleWorker> = {},
): ModuleWorker {
  return {
    method: 'POST',
    load: async () => ({ default: handler }),
    ...overrides,
  };
}

describe('dispatchModuleWorker', () => {
  it('returns 404 when the worker is not found', async () => {
    const res = await dispatchModuleWorker({
      request: makeRequest('POST'),
      moduleId: 'missing',
      workerName: 'noop',
      resolveWorker: () => undefined,
      authenticate: vi.fn(),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      error: 'Worker not found',
      moduleId: 'missing',
      workerName: 'noop',
    });
  });

  it('returns 405 with an Allow header when the method does not match', async () => {
    const handler = vi.fn();
    const res = await dispatchModuleWorker({
      request: makeRequest('GET'),
      moduleId: 'm',
      workerName: 'w',
      resolveWorker: () => makeWorker(handler, { method: 'POST' }),
      authenticate: vi.fn(),
    });
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST');
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated callers when requireAuth is true (default)', async () => {
    const handler = vi.fn();
    const res = await dispatchModuleWorker({
      request: makeRequest('POST'),
      moduleId: 'm',
      workerName: 'w',
      resolveWorker: () => makeWorker(handler),
      authenticate: async () => null,
    });
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('passes auth through to the handler when authentication succeeds', async () => {
    const handler = vi.fn(async ({ auth }) => {
      return NextResponse.json({ userId: auth?.user.id });
    });
    const res = await dispatchModuleWorker({
      request: makeRequest('POST'),
      moduleId: 'm',
      workerName: 'w',
      resolveWorker: () => makeWorker(handler),
      authenticate: async () => fakeAuth,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: 'u1' });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0]).toMatchObject({
      auth: fakeAuth,
      moduleId: 'm',
      workerName: 'w',
    });
  });

  it('skips authentication and passes auth=null when requireAuth is false', async () => {
    const handler = vi.fn(async ({ auth }) =>
      NextResponse.json({ auth }),
    );
    const authenticate = vi.fn();
    const res = await dispatchModuleWorker({
      request: makeRequest('POST'),
      moduleId: 'm',
      workerName: 'w',
      resolveWorker: () =>
        makeWorker(handler, { requireAuth: false }),
      authenticate,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ auth: null });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('defaults the worker method to POST when none is declared', async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const ok = await dispatchModuleWorker({
      request: makeRequest('POST'),
      moduleId: 'm',
      workerName: 'w',
      resolveWorker: () => ({
        load: async () => ({ default: handler }),
      }),
      authenticate: async () => fakeAuth,
    });
    expect(ok.status).toBe(200);

    const wrong = await dispatchModuleWorker({
      request: makeRequest('GET'),
      moduleId: 'm',
      workerName: 'w',
      resolveWorker: () => ({
        load: async () => ({ default: handler }),
      }),
      authenticate: async () => fakeAuth,
    });
    expect(wrong.status).toBe(405);
  });

  it('returns 500 when the lazy import fails', async () => {
    const res = await dispatchModuleWorker({
      request: makeRequest('POST'),
      moduleId: 'm',
      workerName: 'w',
      resolveWorker: () => ({
        load: async () => {
          throw new Error('boom');
        },
      }),
      authenticate: async () => fakeAuth,
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({
      error: 'Internal server error',
    });
  });

  it('returns 500 when the handler throws, surfacing the message', async () => {
    const handler = vi.fn(async () => {
      throw new Error('handler exploded');
    });
    const res = await dispatchModuleWorker({
      request: makeRequest('POST'),
      moduleId: 'm',
      workerName: 'w',
      resolveWorker: () => makeWorker(handler),
      authenticate: async () => fakeAuth,
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({
      error: 'Internal server error',
      message: 'handler exploded',
    });
  });
});
