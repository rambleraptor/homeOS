/**
 * Gift Cards Query Hook — newest first (`-create_time`), ordered server-side.
 */

import { useResourceList } from '@rambleraptor/homestead-core/api/resourceHooks';
import { GIFT_CARDS } from '../resources';
import type { GiftCard } from '../types';

export function useGiftCards() {
  return useResourceList<GiftCard>('gift-cards', 'gift-card', GIFT_CARDS, {
    orderBy: '-create_time',
  });
}
