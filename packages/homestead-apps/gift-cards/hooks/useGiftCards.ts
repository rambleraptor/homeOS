/**
 * Gift Cards Query Hook
 *
 * aepbase has no `sort` query param, so we order client-side by
 * `create_time` desc (newest first).
 */

import {
  useResourceList,
  byCreateTimeDesc,
} from '@rambleraptor/homestead-core/api/resourceHooks';
import { GIFT_CARDS } from '../resources';
import type { GiftCard } from '../types';

export function useGiftCards() {
  return useResourceList<GiftCard>('gift-cards', 'gift-card', GIFT_CARDS, {
    sort: byCreateTimeDesc,
  });
}
