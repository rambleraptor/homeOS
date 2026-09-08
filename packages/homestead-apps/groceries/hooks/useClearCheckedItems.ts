import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { useDeleteGroceryItem } from './useDeleteGroceryItem';
import type { GroceryItem } from '../types';

const ITEMS_KEY = queryKeys.app('groceries').resource('grocery').list();

/**
 * Clear a store's crossed-off items — every checked item assigned to the
 * store (`null` for the "No Store" group). Unchecked items, and items in other
 * stores, are left alone: the shopper keeps what is still outstanding.
 *
 * Each item goes through the normal grocery-delete mutation, so the sweep is
 * optimistic and offline-safe (the member list is read from the cache, not the
 * network) — the same shape as the `useDeleteStore` cascade. Returns the items
 * it removed so the caller can offer an undo.
 */
export function useClearCheckedItems(): (storeId: string | null) => GroceryItem[] {
  const queryClient = useQueryClient();
  const deleteItem = useDeleteGroceryItem();

  return (storeId: string | null) => {
    const items = queryClient.getQueryData<GroceryItem[]>(ITEMS_KEY) ?? [];
    const cleared = items.filter(
      (item) => item.checked && (storeId ? item.store === storeId : !item.store),
    );
    for (const item of cleared) deleteItem.mutate(item.id);
    return cleared;
  };
}
