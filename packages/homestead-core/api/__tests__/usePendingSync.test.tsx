/**
 * Tests for `usePendingSync` / `usePendingSyncIds`.
 *
 * The behaviour that matters is the discrimination: a write genuinely stuck in
 * the offline queue must be reported, and an ordinary in-flight online write
 * must not — otherwise every save in the app flashes an "unsynced" marker for
 * the length of its round trip.
 */

import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  MutationObserver,
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from '@tanstack/react-query';
import { usePendingSync, usePendingSyncIds } from '../usePendingSync';
import {
  clearTempIdMaps,
  registerResourceMutationDefaults,
  resourceMutationKeys,
} from '../registerResourceMutationDefaults';

vi.mock('../aepbase', () => ({
  aepbase: {
    create: vi.fn(async (_plural: string, body: Record<string, unknown>) => ({
      id: 'real_1',
      ...body,
    })),
    update: vi.fn(async () => ({ id: 'real_1' })),
    remove: vi.fn(async () => undefined),
    getCurrentUser: () => ({ id: 'u1' }),
  },
}));

const keys = resourceMutationKeys('groceries', 'grocery');

function makeClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  registerResourceMutationDefaults(client, {
    appId: 'groceries',
    singular: 'grocery',
    plural: 'groceries',
  });
  return client;
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

/** Start a mutation without awaiting it, so it can be observed mid-flight. */
function startMutation<TVars>(
  client: QueryClient,
  mutationKey: readonly unknown[],
  variables: TVars,
) {
  const observer = new MutationObserver<unknown, Error, TVars>(client, {
    mutationKey: mutationKey as unknown[],
  });
  const promise = observer.mutate(variables).catch(() => undefined);
  return { observer, promise };
}

let client: QueryClient;

beforeEach(() => {
  clearTempIdMaps();
  client = makeClient();
  onlineManager.setOnline(true);
});

afterEach(() => {
  onlineManager.setOnline(true);
  client.clear();
});

describe('usePendingSyncIds', () => {
  it('is empty when nothing is queued', () => {
    const { result } = renderHook(() => usePendingSyncIds(), {
      wrapper: wrapper(client),
    });

    expect(result.current.size).toBe(0);
  });

  it('reports a create queued while offline', async () => {
    onlineManager.setOnline(false);
    const { result } = renderHook(() => usePendingSyncIds(), {
      wrapper: wrapper(client),
    });

    startMutation(client, keys.create, { tempId: 'tmp_a', name: 'Milk' });

    await waitFor(() => expect(result.current.has('tmp_a')).toBe(true));
  });

  it('reports a queued update by its record id', async () => {
    onlineManager.setOnline(false);
    const { result } = renderHook(() => usePendingSyncIds(), {
      wrapper: wrapper(client),
    });

    startMutation(client, keys.update, { id: 'rec_1', data: { name: 'Eggs' } });

    await waitFor(() => expect(result.current.has('rec_1')).toBe(true));
  });

  it('reports a queued delete passed as a bare id', async () => {
    onlineManager.setOnline(false);
    const { result } = renderHook(() => usePendingSyncIds(), {
      wrapper: wrapper(client),
    });

    startMutation(client, keys.delete, 'rec_2');

    await waitFor(() => expect(result.current.has('rec_2')).toBe(true));
  });

  it('ignores an ordinary online write', async () => {
    // The whole reason the hook gates on `isPaused` rather than `pending`:
    // an online create resolves in milliseconds and should never be marked.
    const { result } = renderHook(() => usePendingSyncIds(), {
      wrapper: wrapper(client),
    });

    const { promise } = startMutation(client, keys.create, {
      tempId: 'tmp_b',
      name: 'Bread',
    });
    await promise;

    expect(result.current.has('tmp_b')).toBe(false);
  });

  it('clears the id once the queue drains', async () => {
    onlineManager.setOnline(false);
    const { result } = renderHook(() => usePendingSyncIds(), {
      wrapper: wrapper(client),
    });

    startMutation(client, keys.create, { tempId: 'tmp_c', name: 'Jam' });
    await waitFor(() => expect(result.current.has('tmp_c')).toBe(true));

    onlineManager.setOnline(true);

    await waitFor(() => expect(result.current.has('tmp_c')).toBe(false));
  });
});

describe('usePendingSync', () => {
  it('treats an unsent temp id as pending while offline', () => {
    // Safety net for the reload case: the persisted cache still holds the
    // `tmp_` record even if its mutation hasn't re-registered as paused.
    onlineManager.setOnline(false);
    const { result } = renderHook(() => usePendingSync('tmp_orphan'), {
      wrapper: wrapper(client),
    });

    expect(result.current).toBe(true);
  });

  it('does not mark a temp id while online', () => {
    const { result } = renderHook(() => usePendingSync('tmp_orphan'), {
      wrapper: wrapper(client),
    });

    expect(result.current).toBe(false);
  });

  it('does not mark a settled record', () => {
    onlineManager.setOnline(false);
    const { result } = renderHook(() => usePendingSync('rec_9'), {
      wrapper: wrapper(client),
    });

    expect(result.current).toBe(false);
  });
});
