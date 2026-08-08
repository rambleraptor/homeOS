/**
 * Tests for the multi-device notification subscription hooks and the
 * device-label helper that backs the settings "devices" list.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { useUpdateNotificationSubscription } from '../hooks/useUpdateNotificationSubscription';
import { useDeleteNotificationSubscription } from '../hooks/useDeleteNotificationSubscription';
import { describeCurrentDevice } from '@rambleraptor/homestead-core/utils/notifications';

const NOTIFICATION_SUBSCRIPTIONS = 'notification-subscriptions';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

/** A minimal stand-in for the browser PushSubscription. */
function fakePushSubscription(endpoint: string) {
  const json = { endpoint, keys: { p256dh: 'p', auth: 'a' } };
  return { endpoint, toJSON: () => json } as unknown as PushSubscription;
}

describe('useUpdateNotificationSubscription (multi-device dedup)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new subscription when this endpoint is not registered yet', async () => {
    vi.mocked(aepbase.list).mockResolvedValue([
      { id: 'other', subscription_data: { endpoint: 'https://push/OTHER' } },
    ] as never);
    vi.mocked(aepbase.create).mockResolvedValue({ id: 'new' } as never);

    const { result } = renderHook(() => useUpdateNotificationSubscription(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      subscription: fakePushSubscription('https://push/THIS'),
      enabled: true,
      deviceLabel: 'Chrome on macOS',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(aepbase.update).not.toHaveBeenCalled();
    expect(aepbase.create).toHaveBeenCalledWith(
      NOTIFICATION_SUBSCRIPTIONS,
      expect.objectContaining({
        user_id: 'test-user-id',
        enabled: true,
        device_label: 'Chrome on macOS',
        subscription_data: expect.objectContaining({ endpoint: 'https://push/THIS' }),
      }),
      { parent: ['users', 'test-user-id'] },
    );
  });

  it('updates the existing record for a matching endpoint instead of duplicating', async () => {
    vi.mocked(aepbase.list).mockResolvedValue([
      { id: 'mine', subscription_data: { endpoint: 'https://push/THIS' } },
    ] as never);
    vi.mocked(aepbase.update).mockResolvedValue({ id: 'mine' } as never);

    const { result } = renderHook(() => useUpdateNotificationSubscription(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      subscription: fakePushSubscription('https://push/THIS'),
      enabled: true,
      deviceLabel: 'Firefox on Linux',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(aepbase.create).not.toHaveBeenCalled();
    expect(aepbase.update).toHaveBeenCalledWith(
      NOTIFICATION_SUBSCRIPTIONS,
      'mine',
      expect.objectContaining({ enabled: true, device_label: 'Firefox on Linux' }),
      { parent: ['users', 'test-user-id'] },
    );
  });
});

describe('useDeleteNotificationSubscription (targeted deregister)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes exactly the subscription id it is given', async () => {
    vi.mocked(aepbase.remove).mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useDeleteNotificationSubscription(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('device-42');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(aepbase.remove).toHaveBeenCalledWith(
      NOTIFICATION_SUBSCRIPTIONS,
      'device-42',
      { parent: ['users', 'test-user-id'] },
    );
  });
});

describe('describeCurrentDevice', () => {
  it('derives a "Browser on OS" label from the user agent', () => {
    const spy = vi
      .spyOn(navigator, 'userAgent', 'get')
      .mockReturnValue(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      );
    expect(describeCurrentDevice()).toBe('Chrome on macOS');
    spy.mockRestore();
  });
});
