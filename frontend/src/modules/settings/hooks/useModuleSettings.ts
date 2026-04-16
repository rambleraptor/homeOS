/**
 * Fetch the household-wide module-settings singleton and unflatten it
 * into a `{ moduleId: { key: value } }` tree, with declared defaults
 * merged in so every known setting has a value.
 *
 * This is the internal plumbing hook. Components should use
 * `useModuleSetting` for a typed single-setting accessor.
 */

import { useQuery } from '@tanstack/react-query';
import { aepbase, AepCollections } from '@/core/api/aepbase';
import { getAllModuleSettingsDefs } from '@/modules/registry';
import { logger } from '@/core/utils/logger';
import { unflatten, type ModuleSettingsValues } from '../schema';

export const MODULE_SETTINGS_QUERY_KEY = ['module-settings'] as const;

export interface ModuleSettingsRecord {
  id: string;
  [field: string]: unknown;
}

export interface UseModuleSettingsResult {
  values: ModuleSettingsValues;
  record: ModuleSettingsRecord | null;
  isLoading: boolean;
  error: Error | null;
}

export function useModuleSettings(): UseModuleSettingsResult {
  const query = useQuery({
    queryKey: MODULE_SETTINGS_QUERY_KEY,
    queryFn: async (): Promise<ModuleSettingsRecord | null> => {
      try {
        const list = await aepbase.list<ModuleSettingsRecord>(
          AepCollections.MODULE_SETTINGS,
        );
        return list.length > 0 ? list[0] : null;
      } catch (error) {
        // If the resource definition hasn't been registered yet (first
        // run before the instrumentation hook has synced), surface a
        // null record so callers still see defaults rather than
        // crashing.
        logger.warn('Failed to fetch module-settings singleton', {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    },
  });

  const defs = getAllModuleSettingsDefs();
  const values = unflatten(query.data ?? null, defs);

  return {
    values,
    record: query.data ?? null,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}
