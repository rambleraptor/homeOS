/**
 * Charitable Stat Tiles
 *
 * The three things worth knowing about a year's giving beyond its total: how
 * much of it was cash, how much was goods, and what still needs a hand.
 *
 * The third tile is the one that earns its place. Zero is the good state and
 * reads as one; anything else is a receipt that would not survive being asked
 * about — a gift of goods nobody has valued, or a gift of $250 or more with no
 * acknowledgment on file, which the IRS does not allow at all.
 */

import { Banknote, Package, ShieldCheck, TriangleAlert } from 'lucide-react';
import { formatCurrency } from '@rambleraptor/homestead-core/shared/utils/currencyUtils';
import { StatTiles, type StatTile } from '../../shared/StatTiles';
import type { CharitableStats } from '../types';

interface CharitableStatTilesProps {
  stats: CharitableStats;
}

function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

export function CharitableStatTiles({ stats }: CharitableStatTilesProps) {
  const needsAttention = stats.unvalued + stats.missingAcknowledgment;

  const attentionSub = [
    stats.unvalued > 0 ? `${stats.unvalued} unvalued` : null,
    stats.missingAcknowledgment > 0
      ? `${plural(stats.missingAcknowledgment, 'receipt')} over $250 with no acknowledgment`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const tiles: StatTile[] = [
    {
      icon: Banknote,
      label: 'Cash gifts',
      value: formatCurrency(stats.cash),
      sub: plural(stats.cashCount, 'gift'),
      accent: 'bg-emerald-50 text-emerald-600',
    },
    {
      icon: Package,
      label: 'Non-cash gifts',
      value: formatCurrency(stats.nonCash),
      sub:
        stats.unvalued > 0
          ? `${plural(stats.nonCashCount, 'gift')} · ${stats.unvalued} unvalued`
          : plural(stats.nonCashCount, 'gift'),
      accent: 'bg-blue-50 text-blue-600',
    },
    needsAttention > 0
      ? {
          icon: TriangleAlert,
          label: 'Needs attention',
          value: String(needsAttention),
          sub: attentionSub,
          accent: 'bg-amber-50 text-amber-600',
        }
      : {
          icon: ShieldCheck,
          label: 'Needs attention',
          value: 'None',
          sub: 'Every gift is valued and documented',
          accent: 'bg-emerald-50 text-emerald-600',
        },
  ];

  return <StatTiles tiles={tiles} />;
}
