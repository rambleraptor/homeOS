/**
 * Redeem Perk Mutation Hook.
 *
 * Records a redemption for the perk's *current* period. The period boundaries
 * are domain logic (derived from the perk frequency and the card's reset
 * mode / anniversary), so this hook pre-computes them and then delegates the
 * create to the generic offline factory via `useResourceCreate` — inheriting
 * optimistic insertion, offline queueing, and nested-URL resolution for free.
 */

import { useResourceCreate } from '@rambleraptor/homestead-core/api/resourceHooks';
import { getCurrentPeriod, toLocalISODate } from '../utils/periodUtils';
import type {
  PerkRedemption,
  RedemptionFormData,
  CreditCardPerk,
  CreditCard,
} from '../types';

interface RedeemPerkParams {
  perk: CreditCardPerk;
  card: CreditCard;
  amount: number;
  notes?: string;
}

export function useRedeemPerk() {
  const create = useResourceCreate<PerkRedemption, RedemptionFormData>(
    'credit-cards',
    'redemption',
  );

  const toVars = ({
    perk,
    card,
    amount,
    notes,
  }: RedeemPerkParams): RedemptionFormData => {
    const period = getCurrentPeriod(
      perk.frequency,
      card.reset_mode,
      card.anniversary_date,
    );
    return {
      perk: perk.id,
      period_start: toLocalISODate(period.start),
      period_end: toLocalISODate(period.end),
      amount,
      notes,
    };
  };

  return {
    ...create,
    mutate: (params: RedeemPerkParams) => create.mutate(toVars(params)),
    mutateAsync: (params: RedeemPerkParams) => create.mutateAsync(toVars(params)),
  };
}
