/**
 * Create Perk Mutation Hook.
 *
 * Thin shell over the generic offline mutation factory. Perks are nested
 * under credit-cards; the factory derives the `/credit-cards/{id}/perks`
 * URL from the resource definition's `parents` and the `credit_card` FK in
 * the form data (which it strips from the wire body but keeps on the
 * optimistic record for the compute-hook joins). Offline create pauses and
 * replays across reloads with no per-hook scaffolding.
 */

import { useResourceCreate } from '@rambleraptor/homestead-core/api/resourceHooks';
import type { CreditCardPerk, PerkFormData } from '../types';

export function useCreatePerk() {
  return useResourceCreate<CreditCardPerk, PerkFormData>('credit-cards', 'perk');
}
