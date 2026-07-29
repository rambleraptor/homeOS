import {
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { refToId } from '@rambleraptor/homestead-core/resources/references';
import { useResourceDelete } from '@rambleraptor/homestead-core/api/resourceHooks';
import { useDeleteGroceryItem } from './useDeleteGroceryItem';
import type { GroceryItem } from '../types';

const ITEMS_KEY = queryKeys.app('groceries').resource('grocery').list();

/**
 * Delete a store and every grocery item assigned to it. Items with no store
 * (or a different store) are left untouched. Each member item is removed via
 * the normal grocery-delete mutation, so the cascade inherits offline
 * queueing, optimistic removal, and temp-id handling for free — the member
 * list is read from the cache (not the network), so it works offline too.
 */
export function useDeleteStore(): UseMutationResult<string, Error, string> {
  const queryClient = useQueryClient();
  const deleteStore = useResourceDelete('groceries', 'store');
  const deleteItem = useDeleteGroceryItem();

  const cascade = (storeId: string) => {
    const items = queryClient.getQueryData<GroceryItem[]>(ITEMS_KEY) ?? [];
    for (const item of items) {
      if (refToId(item.store) === storeId) deleteItem.mutate(item.id);
    }
  };

  return {
    ...deleteStore,
    mutate: (id: string, options?: Parameters<typeof deleteStore.mutate>[1]) => {
      cascade(id);
      deleteStore.mutate(id, options);
    },
    mutateAsync: (
      id: string,
      options?: Parameters<typeof deleteStore.mutateAsync>[1],
    ) => {
      cascade(id);
      return deleteStore.mutateAsync(id, options);
    },
  } as UseMutationResult<string, Error, string>;
}
