/**
 * Tests for the `notification-subscription:send` custom method — the
 * item-target handler that pushes to a single device (and gives CLI/AEP
 * callers a way to do so).
 *
 * `sendNotificationForAuth` is mocked so the real web-push module never loads.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CustomMethodContext } from '@rambleraptor/homestead-core/resources/types';

const sendNotificationForAuth = vi.fn(
  async () => new Response('{}', { status: 200 }),
);
vi.mock('@rambleraptor/homestead-core/server/notifications', () => ({
  sendNotificationForAuth: (...args: unknown[]) =>
    sendNotificationForAuth(...args),
}));

// Imported after the mock is registered (vi.mock is hoisted regardless).
import handler from '../methods/send-notification';

const auth = {
  token: 'tok',
  user: { id: 'user-1', path: 'users/user-1', email: 'a@b.co' },
};

function makeCtx(overrides: Partial<CustomMethodContext>): CustomMethodContext {
  return {
    request: { json: () => Promise.reject(new Error('no body')) } as Request,
    auth,
    plural: 'notification-subscriptions',
    verb: 'send',
    target: 'item',
    id: 'device-1',
    parent: [],
    ...overrides,
  } as CustomMethodContext;
}

describe('notification-subscription:send', () => {
  beforeEach(() => vi.clearAllMocks());

  it('targets the addressed device and sends a default test notification', async () => {
    await handler(makeCtx({}));

    expect(sendNotificationForAuth).toHaveBeenCalledWith(
      auth,
      expect.objectContaining({
        subscriptionId: 'device-1',
        title: 'Test Notification',
        tag: 'device-test',
        url: '/notifications',
      }),
    );
  });

  it('uses caller-supplied content when a JSON body is provided', async () => {
    const request = {
      json: () =>
        Promise.resolve({
          title: 'Dinner',
          body: 'Roast is ready',
          url: '/recipes/42',
          sourceCollection: 'recipes',
          sourceId: '42',
        }),
    } as Request;

    await handler(makeCtx({ request }));

    expect(sendNotificationForAuth).toHaveBeenCalledWith(
      auth,
      expect.objectContaining({
        subscriptionId: 'device-1',
        title: 'Dinner',
        body: 'Roast is ready',
        url: '/recipes/42',
        sourceCollection: 'recipes',
        sourceId: '42',
      }),
    );
  });

  it('rejects with 400 when no device id is addressed', async () => {
    const res = await handler(makeCtx({ id: undefined }));

    expect(res.status).toBe(400);
    expect(sendNotificationForAuth).not.toHaveBeenCalled();
  });
});
