/**
 * Gift Card Transactions Query Hook
 *
 * Transactions are a child of gift-cards in aepbase, addressed via the URL
 * (`/gift-cards/{id}/transactions`) rather than a filter, so this keeps a
 * per-parent cache key. Newest first (`-create_time`), ordered server-side.
 */

import { useResourceList } from '@rambleraptor/homestead-core/api/resourceHooks';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { GIFT_CARDS, GIFT_CARD_TRANSACTIONS } from '../resources';
import type { GiftCardTransaction } from '../types';

export function useGiftCardTransactions(giftCardId: string | null) {
  return useResourceList<GiftCardTransaction>('gift-cards', 'transaction', {
    plural: GIFT_CARD_TRANSACTIONS,
    orderBy: '-create_time',
    parent: giftCardId ? [GIFT_CARDS, giftCardId] : undefined,
    queryKey: [...queryKeys.app('gift-cards').all(), 'transactions', giftCardId || ''],
    enabled: !!giftCardId,
  });
}
