/**
 * Breakdown Bars
 *
 * Compact strip showing spend per group with a proportional bar — medical
 * expenses by category, giving by organization. The bar is scaled against the
 * largest row rather than the total, so a long tail stays readable.
 */

import type { LucideIcon } from 'lucide-react';
import { SectionCard } from '@rambleraptor/homestead-core/shared/components/SectionCard';
import { formatCurrency } from '@rambleraptor/homestead-core/shared/utils/currencyUtils';

export interface BreakdownRow {
  /** Stable react key; also the tie-breaker when two rows share a label. */
  key: string;
  label: string;
  /** Optional leading icon. A fixed taxonomy has one; an open-ended list doesn't. */
  icon?: LucideIcon;
  /** Tinted background for the icon chip. */
  chip?: string;
  /** Accent text colour that reads on the chip tint. */
  text?: string;
  /** Solid fill for the bar. */
  bar: string;
  total: number;
  count: number;
}

interface BreakdownBarsProps {
  title: string;
  icon: LucideIcon;
  rows: BreakdownRow[];
}

export function BreakdownBars({ title, icon, rows }: BreakdownBarsProps) {
  const visible = rows.filter((r) => r.count > 0).sort((a, b) => b.total - a.total);

  if (visible.length === 0) return null;

  const max = Math.max(...visible.map((r) => r.total), 1);

  return (
    <SectionCard icon={icon} title={title} className="h-full">
      <div className="space-y-4">
        {visible.map((row) => {
          const Icon = row.icon;
          const pct = Math.max(4, Math.round((row.total / max) * 100));
          return (
            <div key={row.key}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {Icon && (
                    <span className={`rounded-md p-1 ${row.chip ?? ''}`} aria-hidden="true">
                      <Icon className={`w-4 h-4 ${row.text ?? ''}`} />
                    </span>
                  )}
                  <span className="text-sm font-medium text-brand-navy truncate">
                    {row.label}
                  </span>
                  <span className="text-xs text-text-muted shrink-0">· {row.count}</span>
                </div>
                <span className="text-sm font-semibold text-brand-navy tabular-nums shrink-0">
                  {formatCurrency(row.total)}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${row.bar}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
