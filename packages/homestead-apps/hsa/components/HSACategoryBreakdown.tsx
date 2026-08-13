/**
 * HSA Category Breakdown
 *
 * Compact strip showing spend per medical-expense category with a proportional
 * bar, driven by the `categoryBreakdown` already computed in `useHSAStats`.
 */

import { PieChart } from 'lucide-react';
import { SectionCard } from '@rambleraptor/homestead-core/shared/components/SectionCard';
import { formatCurrency } from '@rambleraptor/homestead-core/shared/utils/currencyUtils';
import { categoryStyle } from '../categoryConfig';
import type { CategoryBreakdown } from '../types';

interface HSACategoryBreakdownProps {
  breakdown: CategoryBreakdown[];
}

export function HSACategoryBreakdown({ breakdown }: HSACategoryBreakdownProps) {
  const rows = breakdown
    .filter((r) => r.count > 0)
    .sort((a, b) => b.total - a.total);

  if (rows.length === 0) return null;

  const max = Math.max(...rows.map((r) => r.total), 1);

  return (
    <SectionCard icon={PieChart} title="By category" className="h-full">
      <div className="space-y-4">
        {rows.map((row) => {
          const style = categoryStyle(row.category);
          const Icon = style.icon;
          const pct = Math.max(4, Math.round((row.total / max) * 100));
          return (
            <div key={row.category}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`rounded-md p-1 ${style.chip}`} aria-hidden="true">
                    <Icon className={`w-4 h-4 ${style.text}`} />
                  </span>
                  <span className="text-sm font-medium text-brand-navy truncate">
                    {row.category}
                  </span>
                  <span className="text-xs text-text-muted shrink-0">
                    · {row.count}
                  </span>
                </div>
                <span className="text-sm font-semibold text-brand-navy tabular-nums shrink-0">
                  {formatCurrency(row.total)}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${style.bar}`}
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
