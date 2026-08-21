import { useMemo } from 'react';
import { useCharitableReceipts } from './useCharitableReceipts';
import { computeCharitableStats } from '../stats';
import type { CharitableStats } from '../types';

/**
 * Year-scoped giving figures. The caller owns the selected year (it lives in the
 * URL), so this hook takes it rather than holding it — the `years` list it
 * returns is what the caller picks from.
 */
export function useCharitableStats(year: number) {
  const { data: receipts, ...queryResult } = useCharitableReceipts();

  const stats: CharitableStats | undefined = useMemo(
    () => (receipts ? computeCharitableStats(receipts, year) : undefined),
    [receipts, year],
  );

  return { stats, ...queryResult };
}
