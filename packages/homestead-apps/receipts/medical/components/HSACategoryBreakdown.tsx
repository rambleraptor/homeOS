/**
 * HSA Category Breakdown
 *
 * Spend per medical-expense category, drawn on the shared bars with the fixed
 * per-category icon and colour from `categoryConfig`.
 */

import { PieChart } from 'lucide-react';
import { BreakdownBars, type BreakdownRow } from '../../shared/BreakdownBars';
import { categoryStyle } from '../categoryConfig';
import type { CategoryBreakdown } from '../types';

interface HSACategoryBreakdownProps {
  breakdown: CategoryBreakdown[];
}

export function HSACategoryBreakdown({ breakdown }: HSACategoryBreakdownProps) {
  const rows: BreakdownRow[] = breakdown.map((row) => {
    const style = categoryStyle(row.category);
    return {
      key: row.category,
      label: row.category,
      icon: style.icon,
      chip: style.chip,
      text: style.text,
      bar: style.bar,
      total: row.total,
      count: row.count,
    };
  });

  return <BreakdownBars title="By category" icon={PieChart} rows={rows} />;
}
