/**
 * Giving by organization for the selected year.
 *
 * Charities are an open set, so the strip shows the six largest and folds the
 * rest into one "Other" row — a long tail of $20 gifts is worth a line, not
 * twenty of them.
 */

import { HandHeart } from 'lucide-react';
import { BreakdownBars, type BreakdownRow } from '../../shared/BreakdownBars';
import { orgBarColor } from '../orgPalette';
import type { OrganizationBreakdown } from '../types';

/** How many charities get their own bar before the tail is folded up. */
const TOP_N = 6;

interface CharitableOrgBreakdownProps {
  breakdown: OrganizationBreakdown[];
}

export function CharitableOrgBreakdown({ breakdown }: CharitableOrgBreakdownProps) {
  // `breakdown` arrives largest-first from `summarizeOrganizations`.
  const top = breakdown.slice(0, TOP_N);
  const tail = breakdown.slice(TOP_N);

  const rows: BreakdownRow[] = top.map((row, index) => ({
    key: row.organization,
    label: row.organization,
    bar: orgBarColor(index),
    total: row.total,
    count: row.count,
  }));

  if (tail.length > 0) {
    rows.push({
      key: '__other__',
      label: `Other (${tail.length})`,
      bar: 'bg-gray-400',
      total: tail.reduce((sum, row) => sum + row.total, 0),
      count: tail.reduce((sum, row) => sum + row.count, 0),
    });
  }

  return <BreakdownBars title="By organization" icon={HandHeart} rows={rows} />;
}
