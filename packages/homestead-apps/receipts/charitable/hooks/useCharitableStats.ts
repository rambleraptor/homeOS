import { useMemo } from 'react';
import { useCharitableReceipts } from './useCharitableReceipts';
import { computeCharitableStats, defaultYear, summarizeYears } from '../stats';
import type { CharitableStats } from '../types';

/**
 * Year-scoped giving figures.
 *
 * The selected year lives in the URL, so the caller passes it — but only once
 * the reader has picked one. Left undefined, the hook resolves the year itself
 * (this year when there's giving in it, otherwise the most recent year that
 * has any) and reports what it landed on as `stats.year`. That keeps the
 * chicken-and-egg out of the component: you can't pick a sensible year until
 * you've loaded the receipts that say which years exist.
 */
export function useCharitableStats(year?: number) {
  const { data: receipts, ...queryResult } = useCharitableReceipts();

  const stats: CharitableStats | undefined = useMemo(() => {
    if (!receipts) return undefined;
    const resolved =
      year ?? defaultYear(summarizeYears(receipts), new Date().getFullYear());
    return computeCharitableStats(receipts, resolved);
  }, [receipts, year]);

  return { stats, ...queryResult };
}
