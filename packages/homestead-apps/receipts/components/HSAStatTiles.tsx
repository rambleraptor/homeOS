/**
 * HSA Stat Tiles
 *
 * Secondary metrics that sit under the hero KPI: reimbursed to date, receipts
 * tracked, and the lifetime total tracked. Surfaces figures `useHSAStats`
 * already computes but the old UI never showed.
 */

import type { LucideIcon } from 'lucide-react';
import { Banknote, ReceiptText, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@rambleraptor/homestead-core/shared/utils/currencyUtils';
import type { HSAStats } from '../types';

interface Tile {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  accent: string;
}

interface HSAStatTilesProps {
  stats: HSAStats;
}

export function HSAStatTiles({ stats }: HSAStatTilesProps) {
  const lifetime = stats.totalStored + stats.totalReimbursed;

  const tiles: Tile[] = [
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <div
            key={tile.label}
            className="rounded-2xl border border-gray-100 bg-surface-white p-5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className={`rounded-lg p-2 ${tile.accent}`} aria-hidden="true">
                <Icon className="w-5 h-5" />
              </span>
              <p className="text-sm font-medium text-text-muted">{tile.label}</p>
            </div>
            <p className="mt-3 font-display text-2xl font-bold text-brand-navy tabular-nums">
              {tile.value}
            </p>
            <p className="mt-1 text-xs text-text-muted">{tile.sub}</p>
          </div>
        );
      })}
    </div>
  );
}
