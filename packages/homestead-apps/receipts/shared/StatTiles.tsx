/**
 * Stat Tiles
 *
 * The secondary metrics that sit under a tab's hero KPI. Each tab builds its
 * own three tiles; this only lays them out.
 */

import type { LucideIcon } from 'lucide-react';

export interface StatTile {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  /** Tailwind chip classes, written out in full so the scanner emits them. */
  accent: string;
}

interface StatTilesProps {
  tiles: StatTile[];
}

export function StatTiles({ tiles }: StatTilesProps) {
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
