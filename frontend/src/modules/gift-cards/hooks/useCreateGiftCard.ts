/**
 * Create Gift Card Mutation Hook
 *
 * Creates a new gift card in PocketBase
 */

import { useMutation } from '@tanstack/react-query';
import { queryClient, queryKeys } from '@/core/api/queryClient';
import { Collections, getCollection, getCurrentUser } from '@/core/api/pocketbase';
import type { GiftCard, GiftCardFormData } from '../types';

export function useCreateGiftCard() {
  return useMutation({
    mutationFn: async (data: GiftCardFormData) => {
      const currentUser = getCurrentUser();
      const cardData = {
        ...data,
        created_by: currentUser?.id,
      };

      return await getCollection<GiftCard>(Collections.GIFT_CARDS).create(cardData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.module('gift-cards').all(),
      });
    },
  });
}
