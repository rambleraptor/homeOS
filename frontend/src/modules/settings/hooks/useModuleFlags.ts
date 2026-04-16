/**
 * Fetch the household-wide module-flags singleton and unflatten it
 * into a `{ moduleId: { key: value } }` tree, with declared defaults
 * merged in so every known flag has a value.
 *
 * This is the internal plumbing hook. Components should use
 * `useModuleFlag` for a typed single-flag accessor.
 */

import { useQuery } from '@tanstack/react-query';
import { aepbase, AepCollections } from '@/core/api/aepbase';
import { getAllModuleFlagDefs } from '@/modules/registry';
import { logger } from '@/core/utils/logger';
import { unflatten, type ModuleFlagValues } from '../flags';

export const MODULE_FLAGS_QUERY_KEY = ['module-flags'] as const;

export interface ModuleFlagsRecord {
  id: string;
  [field: string]: unknown;
}

export interface UseModuleFlagsResult {
  values: ModuleFlagValues;
  record: ModuleFlagsRecord | null;
  isLoading: boolean;
  error: Error | null;
}

export function useModuleFlags(): UseModuleFlagsResult {
  const query = useQuery({
    queryKey: MODULE_FLAGS_QUERY_KEY,
    queryFn: async (): Promise<ModuleFlagsRecord | null> => {
      try {
        const list = await aepbase.list<ModuleFlagsRecord>(
          AepCollections.MODULE_FLAGS,
        );
        return list.length > 0 ? list[0] : null;
      } catch (error) {
        // If the resource definition hasn't been registered yet (first
        // run before the instrumentation hook has synced), surface a
        // null record so callers still see defaults rather than
        // crashing.
        logger.warn('Failed to fetch module-flags singleton', {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    },
  });

  const defs = getAllModuleFlagDefs();
  const values = unflatten(query.data ?? null, defs);

  return {
    values,
    record: query.data ?? null,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}
