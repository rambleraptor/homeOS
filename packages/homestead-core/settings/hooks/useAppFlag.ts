/**
 * Public hook for reading + writing a single app flag.
 *
 *   const { value, setValue } =
 *     useAppFlag<string>('groceries', 'default_store');
 *
 * Returns the declared default when nothing has been saved yet, so
 * callers never have to guard against `undefined`. `setValue` upserts
 * the household singleton and invalidates the shared query so other
 * consumers see the change on the next render.
 */

import { useCallback } from 'react';
import type { AppFlagValue } from '@rambleraptor/homestead-core/apps/types';
import { useAppFlags } from './useAppFlags';
import { useUpdateAppFlag } from './useUpdateAppFlag';

export interface UseAppFlagResult<T extends AppFlagValue> {
  value: T | undefined;
  setValue: (value: T) => Promise<void>;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
}

export function useAppFlag<T extends AppFlagValue = AppFlagValue>(
  appId: string,
  key: string,
): UseAppFlagResult<T> {
  const { values, isLoading, error } = useAppFlags();
  const mutation = useUpdateAppFlag();

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
