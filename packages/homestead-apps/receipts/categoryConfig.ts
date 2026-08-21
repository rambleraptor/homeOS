/**
 * Per-category visual config for HSA receipts.
 *
 * Centralizes the color + icon for each medical-expense category so badges,
 * breakdown bars, and thumbnails stay consistent everywhere. Class names are
 * written out in full (not composed) so Tailwind's content scanner emits them.
 */

import type { LucideIcon } from 'lucide-react';
import { Stethoscope, Pill, Eye, Smile } from 'lucide-react';
import type { ReceiptCategory } from './types';

export interface CategoryStyle {
  /** Lucide icon representing the category. */
  icon: LucideIcon;
  /** Soft pill classes for a status/category badge. */
  badge: string;
  /** Solid fill for a proportional bar. */
  bar: string;
  /** Tinted background for an icon chip. */
  chip: string;
  /** Accent text/icon color that reads on the chip tint. */
  text: string;
}

export const CATEGORY_STYLES: Record<ReceiptCategory, CategoryStyle> = {
  Medical: {
    icon: Stethoscope,
    badge: 'bg-blue-50 text-blue-700',
    bar: 'bg-blue-500',
    chip: 'bg-blue-50',
    text: 'text-blue-600',
  },
  Dental: {
    icon: Smile,
    badge: 'bg-cyan-50 text-cyan-700',
    bar: 'bg-cyan-500',
    chip: 'bg-cyan-50',
    text: 'text-cyan-600',
  },
  Vision: {
    icon: Eye,
    badge: 'bg-amber-50 text-amber-700',
    bar: 'bg-amber-500',
    chip: 'bg-amber-50',
    text: 'text-amber-600',
  },
  Rx: {
    icon: Pill,
    badge: 'bg-violet-50 text-violet-700',
    bar: 'bg-violet-500',
    chip: 'bg-violet-50',
    text: 'text-violet-600',
  },
};

/** Stable display order for category strips/legends. */
export const CATEGORY_ORDER: ReceiptCategory[] = [
  'Medical',
  'Dental',
  'Vision',
  'Rx',
];

export function categoryStyle(category: ReceiptCategory): CategoryStyle {
  return CATEGORY_STYLES[category] ?? CATEGORY_STYLES.Medical;
}
