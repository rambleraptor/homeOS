/**
 * Create Redemption Mutation Hook. See `useCreatePerk.ts`.
 *
 * Unlike `useRedeemPerk` this accepts explicit period dates for historical
 * entries. Redemptions are two levels deep; the factory walks
 * redemption → perk → card via the `perk` FK and the perk's cached record to
 * build the `/credit-cards/{id}/perks/{id}/redemptions` URL.
 */

import { useResourceCreate } from '@rambleraptor/homestead-core/api/resourceHooks';
import type { PerkRedemption, RedemptionFormData } from '../types';

export function useCreateRedemption() {
  return useResourceCreate<PerkRedemption, RedemptionFormData>(
    'credit-cards',
    'redemption',
  );
}
