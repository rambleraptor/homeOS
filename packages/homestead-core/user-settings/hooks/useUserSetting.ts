/**
 * Public hook for reading + writing a single per-user app setting.
 *
 *   const { value, setValue } =
 *     useUserSetting<'google' | 'apple'>('people', 'map_provider');
 *
 * Returns the declared default when nothing has been saved yet, so
 * callers never have to guard against `undefined`. `setValue` upserts
 * the user's `user-preference` record and invalidates the shared query
 * so other consumers see the change on the next render.
 */

import { useCallback } from 'react';
import type { UserSettingValue } from '@rambleraptor/homestead-core/apps/types';
import { useUserSettings } from './useUserSettings';
import { useUpdateUserSetting } from './useUpdateUserSetting';

export interface UseUserSettingResult<T extends UserSettingValue> {
  value: T | undefined;
  setValue: (value: T) => Promise<void>;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
}

export function useUserSetting<T extends UserSettingValue = UserSettingValue>(
  appId: string,
  key: string,
): UseUserSettingResult<T> {
  const { values, isLoading, error } = useUserSettings();
  const mutation = useUpdateUserSetting();

  const value = values[appId]?.[key] as T | undefined;

  const setValue = useCallback(
    async (next: T) => {
      await mutation.mutateAsync({ appId, key, value: next });
    },
    [mutation, appId, key],
  );

  return {
    value,
    setValue,
    isLoading,
    isSaving: mutation.isPending,
    error,
  };
}
