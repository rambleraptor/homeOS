/**
 * Delete Redemption Mutation Hook. See `useCreateRedemption.ts`.
 */

import { useResourceDelete } from '@rambleraptor/homestead-core/api/resourceHooks';

export function useDeleteRedemption() {
  return useResourceDelete('credit-cards', 'redemption');
}
