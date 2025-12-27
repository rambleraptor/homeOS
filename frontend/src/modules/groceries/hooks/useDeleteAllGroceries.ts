/**
 * Delete All Groceries Hook
 *
 * Mutation for deleting all grocery items
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryClient';
import { Collections, getCollection } from '@/core/api/pocketbase';
import { logger } from '@/core/utils/logger';
import type { GroceryItem } from '../types';

export function useDeleteAllGroceries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const items = await getCollection<GroceryItem>(Collections.GROCERIES).getFullList();
      await Promise.all(items.map((item) => getCollection(Collections.GROCERIES).delete(item.id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.module('groceries').list() });
    },
    onError: (error) => {
      logger.error('Failed to delete all grocery items', error);
    },
  });
}
