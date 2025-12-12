/**
 * Merchant Summaries Hook
 *
 * Computes merchant summaries from gift cards data
 */

import { useMemo } from 'react';
import { useGiftCards } from './useGiftCards';
import type { MerchantSummary, GiftCardStats } from '../types';

export function useMerchantSummaries() {
  const { data: giftCards, ...queryResult } = useGiftCards();

  const stats: GiftCardStats | undefined = useMemo(() => {
    if (!giftCards) return undefined;

    // Group cards by merchant
    const merchantMap = new Map<string, MerchantSummary>();

    giftCards.forEach((card) => {
      const existing = merchantMap.get(card.merchant);
      if (existing) {
        existing.totalAmount += card.amount;
        existing.cardCount += 1;
        existing.cards.push(card);
      } else {
        merchantMap.set(card.merchant, {
          merchant: card.merchant,
          totalAmount: card.amount,
          cardCount: 1,
          cards: [card],
        });
      }
    });

    const merchants = Array.from(merchantMap.values()).sort((a, b) =>
      a.merchant.localeCompare(b.merchant)
    );

    return {
      totalCards: giftCards.length,
      totalAmount: merchants.reduce((sum, m) => sum + m.totalAmount, 0),
      merchantCount: merchants.length,
      merchants,
    };
  }, [giftCards]);

  return {
    stats,
    ...queryResult,
  };
}
