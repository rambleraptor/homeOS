/**
 * Credit Cards Query Hook.
 */

import {
  useResourceList,
  byCreateTimeDesc,
} from '@rambleraptor/homestead-core/api/resourceHooks';
import { CREDIT_CARDS } from '../resources';
import type { CreditCard } from '../types';

export function useCreditCards() {
  return useResourceList<CreditCard>('credit-cards', 'credit-card', CREDIT_CARDS, {
    sort: byCreateTimeDesc,
  });
}
