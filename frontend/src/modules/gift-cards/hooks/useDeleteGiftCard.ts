/**
 * Delete Gift Card Mutation Hook
 *
 * Deletes a gift card from PocketBase
 */

import { useMutation } from '@tanstack/react-query';
import { queryClient, queryKeys } from '@/core/api/queryClient';
import { Collections, getCollection } from '@/core/api/pocketbase';

export function useDeleteGiftCard() {
  return useMutation({
    mutationFn: async (id: string) => {
      return await getCollection(Collections.GIFT_CARDS).delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.module('gift-cards').all(),
      });
    },
  });
}
