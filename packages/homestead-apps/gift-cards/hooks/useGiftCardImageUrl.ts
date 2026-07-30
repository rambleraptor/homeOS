/**
 * Resolve a gift-card image field to a blob URL the browser can render.
 * Thin wrapper over the shared `useFileFieldUrl`.
 */

import { useFileFieldUrl } from '@rambleraptor/homestead-core/api/resourceHooks';
import { GIFT_CARDS } from '../resources';
import type { GiftCard } from '../types';

type ImageField = 'front_image' | 'back_image';

export function useGiftCardImageUrl(
  card: GiftCard | null | undefined,
  field: ImageField,
): string | null {
  return useFileFieldUrl(GIFT_CARDS, card?.id, field, card?.[field]);
}
