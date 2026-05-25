/**
 * Renders a gift-card image (front or back). Returns null while the
 * aepbase blob is loading and on download failure.
 */

import type { GiftCard } from '../types';
import { useGiftCardImageUrl } from '../hooks/useGiftCardImageUrl';

interface GiftCardImageProps {
  card: GiftCard;
  field: 'front_image' | 'back_image';
  alt: string;
  className?: string;
}

export function GiftCardImage({ card, field, alt, className }: GiftCardImageProps) {
  const url = useGiftCardImageUrl(card, field);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} />;
}
