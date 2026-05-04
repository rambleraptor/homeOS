/**
 * Perk Redemptions Query Hook.
 *
 * Redemptions are two levels deep (`/credit-cards/{id}/perks/{id}/redemptions`).
 * We walk cards → perks → redemptions and inject the `perk` parent id on
 * each result so the compute hooks can keep joining by it.
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { CREDIT_CARDS, CREDIT_CARD_PERKS, PERK_REDEMPTIONS } from '../resources';
import type { CreditCard, CreditCardPerk, PerkRedemption } from '../types';

export function usePerkRedemptions() {
  return useQuery({
    queryKey: queryKeys.module('credit-cards').list({ type: 'redemptions' }),
    queryFn: async (): Promise<PerkRedemption[]> => {
      const cards = await aepbase.list<CreditCard>(CREDIT_CARDS);
      const all: PerkRedemption[] = [];
      for (const card of cards) {
        const perks = await aepbase.list<CreditCardPerk>(
          CREDIT_CARD_PERKS,
          { parent: [CREDIT_CARDS, card.id] },
        );
        for (const perk of perks) {
          const reds = await aepbase.list<PerkRedemption>(
            PERK_REDEMPTIONS,
            {
              parent: [
                CREDIT_CARDS, card.id,
                CREDIT_CARD_PERKS, perk.id,
              ],
            },
          );
          for (const r of reds) all.push({ ...r, perk: perk.id });
        }
      }
      return all.sort((a, b) =>
        (b.period_start || '').localeCompare(a.period_start || ''),
      );
    },
  });
}
