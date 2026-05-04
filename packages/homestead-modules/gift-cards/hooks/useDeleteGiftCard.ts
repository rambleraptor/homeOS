/**
 * Delete Gift Card Mutation Hook
 * Cascade-deletes child transactions.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { GIFT_CARDS } from '../resources';

export function useDeleteGiftCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await aepbase.remove(GIFT_CARDS, id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.module('gift-cards').all(),
      });
      await queryClient.refetchQueries({
        queryKey: queryKeys.module('gift-cards').all(),
      });
    },
  });
}
