/**
 * Optimistic create / update / delete for the `stores` collection.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import {
  clearTempIdMaps,
  newTempId,
} from '@rambleraptor/homestead-core/api/registerResourceMutationDefaults';
import type { Store } from '../../types';
import { makeGroceriesClient, runMutation, storeKeys } from './testUtils';

const STORES_KEY = queryKeys.app('groceries').resource('store').list();

beforeEach(() => {
  vi.clearAllMocks();
  clearTempIdMaps();
});

describe('create-store', () => {
  it('inserts an optimistic store and reconciles with the server id', async () => {
    const client = makeGroceriesClient();
    client.setQueryData<Store[]>(STORES_KEY, []);
    vi.mocked(aepbase.create).mockResolvedValueOnce({
      id: 'store-srv-1',
      name: 'Costco',
      sort_order: 0,
      created: '2026-04-27T00:00:00Z',
      updated: '2026-04-27T00:00:00Z',
    });

    const tempId = newTempId();
    await runMutation(client, storeKeys.create, {
      name: 'Costco',
      sort_order: 0,
      tempId,
    });

    const list = client.getQueryData<Store[]>(STORES_KEY) ?? [];
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('store-srv-1');
  });
});

describe('update-store', () => {
  it('renames optimistically and rolls back on error', async () => {
    const client = makeGroceriesClient();
    const seed: Store[] = [
      {
        id: 'store-1',
        name: 'Aldi',
        sort_order: 0,
        created: '2026-04-26T00:00:00Z',
        updated: '2026-04-26T00:00:00Z',
      },
    ];
    client.setQueryData<Store[]>(STORES_KEY, seed);
    vi.mocked(aepbase.update).mockRejectedValueOnce(new Error('boom'));

    await expect(
      runMutation(client, storeKeys.update, {
        id: 'store-1',
        data: { name: 'Trader Joes' },
      }),
    ).rejects.toThrow();

    expect(client.getQueryData<Store[]>(STORES_KEY)).toEqual(seed);
  });
});

describe('delete-store', () => {
  // The raw factory delete removes the store record only. The item cascade
  // (deleting the store's items) lives in the `useDeleteStore` hook — see
  // useDeleteStore.test.tsx.
  it('removes the store optimistically and rolls back on error', async () => {
    const client = makeGroceriesClient();
    const stores: Store[] = [
      {
        id: 'store-1',
        name: 'Aldi',
        sort_order: 0,
        created: '2026-04-26T00:00:00Z',
        updated: '2026-04-26T00:00:00Z',
      },
    ];
    client.setQueryData<Store[]>(STORES_KEY, stores);
    vi.mocked(aepbase.remove).mockResolvedValueOnce(undefined);

    await runMutation(client, storeKeys.delete, 'store-1');

    expect(aepbase.remove).toHaveBeenCalledWith('stores', 'store-1', { force: true });
    expect(client.getQueryData<Store[]>(STORES_KEY) ?? []).toHaveLength(0);
  });

  it('restores the store when the server rejects', async () => {
    const client = makeGroceriesClient();
    const stores: Store[] = [
      {
        id: 'store-1',
        name: 'Aldi',
        sort_order: 0,
        created: '2026-04-26T00:00:00Z',
        updated: '2026-04-26T00:00:00Z',
      },
    ];
    client.setQueryData<Store[]>(STORES_KEY, stores);
    vi.mocked(aepbase.remove).mockRejectedValueOnce(new Error('boom'));

    await expect(
      runMutation(client, storeKeys.delete, 'store-1'),
    ).rejects.toThrow();

    expect(client.getQueryData<Store[]>(STORES_KEY)).toEqual(stores);
  });
});
