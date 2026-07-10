/**
 * Update Perk Mutation Hook. See `useCreatePerk.ts`.
 *
 * The factory recovers the parent credit-card id from the perk's cached
 * record, so no explicit parent wiring is needed.
 */

import { useResourceUpdate } from '@rambleraptor/homestead-core/api/resourceHooks';
import type { CreditCardPerk, PerkFormData } from '../types';

export function useUpdatePerk() {
  return useResourceUpdate<CreditCardPerk, Partial<PerkFormData>>(
    'credit-cards',
    'perk',
  );
}
