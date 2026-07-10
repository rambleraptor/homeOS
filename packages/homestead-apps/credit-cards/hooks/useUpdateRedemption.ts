/**
 * Update Redemption Mutation Hook. See `useCreateRedemption.ts`.
 */

import { useResourceUpdate } from '@rambleraptor/homestead-core/api/resourceHooks';
import type { PerkRedemption, RedemptionFormData } from '../types';

export function useUpdateRedemption() {
  return useResourceUpdate<PerkRedemption, Partial<RedemptionFormData>>(
    'credit-cards',
    'redemption',
  );
}
