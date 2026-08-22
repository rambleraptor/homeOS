/**
 * HSA Stat Tiles
 *
 * The secondary metrics under the medical hero KPI: reimbursed to date,
 * receipts tracked, and the lifetime total tracked.
 */

import { Banknote, ReceiptText, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@rambleraptor/homestead-core/shared/utils/currencyUtils';
import { StatTiles, type StatTile } from '../../shared/StatTiles';
import type { HSAStats } from '../types';

interface HSAStatTilesProps {
  stats: HSAStats;
}

export function HSAStatTiles({ stats }: HSAStatTilesProps) {
  const lifetime = stats.totalStored + stats.totalReimbursed;

  const tiles: StatTile[] = [
    {
      icon: Banknote,
      label: 'Reimbursed to date',
      value: formatCurrency(stats.totalReimbursed),
      sub: `${stats.reimbursedReceipts} ${stats.reimbursedReceipts === 1 ? 'receipt' : 'receipts'} withdrawn`,
      accent: 'bg-emerald-50 text-emerald-600',
    },
    {
      icon: ReceiptText,
      label: 'Receipts tracked',
      value: String(stats.totalReceipts),
      sub: `${stats.storedReceipts} still stored`,
      accent: 'bg-accent-terracotta/10 text-accent-terracotta',
    },
    {
      icon: TrendingUp,
      label: 'Lifetime tracked',
      value: formatCurrency(lifetime),
      sub: 'Stored + reimbursed',
      accent: 'bg-blue-50 text-blue-600',
    },
  ];

  return <StatTiles tiles={tiles} />;
}
