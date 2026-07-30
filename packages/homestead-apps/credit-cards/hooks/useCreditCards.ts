/**
 * Credit Cards Query Hook — newest first (`-create_time`), ordered server-side.
 */

import { useResourceList } from '@rambleraptor/homestead-core/api/resourceHooks';
import { CREDIT_CARDS } from '../resources';
import type { CreditCard } from '../types';

export function useCreditCards() {
  return useResourceList<CreditCard>('credit-cards', 'credit-card', CREDIT_CARDS, {
    orderBy: '-create_time',
  });
}
