/**
 * Delete Gift Card Mutation Hook
 *
 * Deletes a gift card from PocketBase
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryClient';
import { Collections, getCollection } from '@/core/api/pocketbase';

export function useDeleteGiftCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await getCollection(Collections.GIFT_CARDS).delete(id);
    },
    onSuccess: async () => {
      // Invalidate and refetch gift cards queries
      // invalidateQueries marks as stale, refetchQueries triggers immediate refetch
      // Both together ensure data is fresh before mutation resolves
      await queryClient.invalidateQueries({
        queryKey: queryKeys.module('gift-cards').all(),
      });
      await queryClient.refetchQueries({
        queryKey: queryKeys.module('gift-cards').all(),
      });
    },
  });
}
