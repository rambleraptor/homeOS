/**
 * Gift Card Transactions Query Hook
 *
 * Transactions are a child of gift-cards in aepbase, addressed via the URL
 * (`/gift-cards/{id}/transactions`) rather than a filter, so this keeps a
 * per-parent cache key. Newest first (`-create_time`), ordered server-side.
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { GIFT_CARDS, GIFT_CARD_TRANSACTIONS } from '../resources';
import type { GiftCardTransaction } from '../types';

export function useGiftCardTransactions(giftCardId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.app('gift-cards').all(), 'transactions', giftCardId || ''],
    queryFn: async () => {
      if (!giftCardId) return [];
      return aepbase.list<GiftCardTransaction>(GIFT_CARD_TRANSACTIONS, {
        parent: [GIFT_CARDS, giftCardId],
        orderBy: '-create_time',
      });
    },
    enabled: !!giftCardId,
  });
}
