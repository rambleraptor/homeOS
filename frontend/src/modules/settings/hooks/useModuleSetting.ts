/**
 * Public hook for reading + writing a single module setting.
 *
 *   const { value, setValue } =
 *     useModuleSetting<'superuser' | 'all'>('settings', 'omnibox_access');
 *
 * Returns the declared default when nothing has been saved yet, so
 * callers never have to guard against `undefined`. `setValue` upserts
 * the household singleton and invalidates the shared query so other
 * consumers see the change on the next render.
 */

import { useCallback } from 'react';
import type { ModuleSettingValue } from '../../types';
import { useModuleSettings } from './useModuleSettings';
import { useUpdateModuleSetting } from './useUpdateModuleSetting';

export interface UseModuleSettingResult<T extends ModuleSettingValue> {
  value: T | undefined;
  setValue: (value: T) => Promise<void>;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
}

export function useModuleSetting<T extends ModuleSettingValue = ModuleSettingValue>(
  moduleId: string,
  key: string,
): UseModuleSettingResult<T> {
  const { values, isLoading, error } = useModuleSettings();
  const mutation = useUpdateModuleSetting();

  const value = values[moduleId]?.[key] as T | undefined;

  const setValue = useCallback(
    async (next: T) => {
      await mutation.mutateAsync({ moduleId, key, value: next });
    },
    [mutation, moduleId, key],
  );

  return {
    value,
    setValue,
    isLoading,
    isSaving: mutation.isPending,
    error,
  };
}
