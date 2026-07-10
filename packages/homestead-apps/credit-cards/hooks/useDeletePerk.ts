/**
 * Delete Perk Mutation Hook. See `useCreatePerk.ts`.
 *
 * `useResourceDelete` resolves the perk's `/credit-cards/{id}/perks` parent
 * chain from cache before the optimistic removal and bakes it into the
 * (persisted) mutation variables, so an offline delete survives a reload.
 */

import { useResourceDelete } from '@rambleraptor/homestead-core/api/resourceHooks';

export function useDeletePerk() {
  return useResourceDelete('credit-cards', 'perk');
}
