/**
 * AEP-151 operations list + polling.
 *
 * Operations are a top-level, household-shared collection (`/operations`), so
 * unlike notifications the list is unscoped. While any operation is still
 * running the query polls every few seconds; it stops polling once everything
 * is `done` (this is the app's only polling query).
 */

import { useQuery } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { OPERATIONS } from '@rambleraptor/homestead-core/resources/builtins';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import type { Operation } from '../types';

const POLL_INTERVAL_MS = 3000;

interface AepOperation extends Omit<Operation, 'created' | 'updated'> {
  create_time: string;
  update_time: string;
}

function normalize(rec: AepOperation): Operation {
  return {
    ...rec,
    created: rec.create_time || '',
    updated: rec.update_time || '',
  };
}

export async function fetchOperations(): Promise<Operation[]> {
  if (!aepbase.getCurrentUser()?.id) return [];
  const list = await aepbase.list<AepOperation>(OPERATIONS);
  return list
    .map(normalize)
    .sort((a, b) => (b.created || '').localeCompare(a.created || ''));
}

const operationsKey = queryKeys.app('notifications').resource('operation').list();

export function useOperations() {
  return useQuery({
    queryKey: operationsKey,
    queryFn: fetchOperations,
    // Poll while anything is in flight; stop once all operations are done.
    refetchInterval: (query) =>
      query.state.data?.some((op) => !op.done) ? POLL_INTERVAL_MS : false,
  });
}

/** True when at least one operation is still running. Feeds the top-bar spinner. */
export function useHasOngoingOperations(): boolean {
  const { data } = useOperations();
  return !!data?.some((op) => !op.done);
}
