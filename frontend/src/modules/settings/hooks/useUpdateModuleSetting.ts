/**
 * Upsert a single module setting on the household-wide singleton.
 *
 * Internal plumbing — components should use `useModuleSetting`. The
 * mutation flattens `(moduleId, key)` into the aepbase field name,
 * then either PATCHes the existing record or POSTs a new one if none
 * exists yet.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aepbase, AepCollections } from '@/core/api/aepbase';
import type { ModuleSettingValue } from '../../types';
import { fieldName } from '../schema';
import {
  MODULE_SETTINGS_QUERY_KEY,
  type ModuleSettingsRecord,
} from './useModuleSettings';

export interface UpdateModuleSettingArgs {
  moduleId: string;
  key: string;
  value: ModuleSettingValue;
}

export function useUpdateModuleSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ moduleId, key, value }: UpdateModuleSettingArgs) => {
      const flat = fieldName(moduleId, key);
      const payload = { [flat]: value };

      const existing = await aepbase.list<ModuleSettingsRecord>(
        AepCollections.MODULE_SETTINGS,
      );

      if (existing.length > 0) {
        return await aepbase.update<ModuleSettingsRecord>(
          AepCollections.MODULE_SETTINGS,
          existing[0].id,
          payload,
        );
      }
      return await aepbase.create<ModuleSettingsRecord>(
        AepCollections.MODULE_SETTINGS,
        payload,
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: MODULE_SETTINGS_QUERY_KEY,
      });
    },
  });
}
