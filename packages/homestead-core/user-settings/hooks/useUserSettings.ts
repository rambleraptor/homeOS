'use client';

/**
 * Fetch the signed-in user's `user-preference` record and unflatten it
 * into a `{ moduleId: { key: value } }` tree, with declared defaults
 * merged in so every known setting has a value.
 *
 * Internal plumbing — components should reach for `useUserSetting`.
 */

import { useQuery } from '@tanstack/react-query';
import { aepbase, AepbaseError } from '@rambleraptor/homestead-core/api/aepbase';
import {
  USERS,
  USER_PREFERENCES,
} from '@rambleraptor/homestead-core/resources/builtins';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import { getAllUserSettingDefs } from '@rambleraptor/homestead-app/registry/registry';
import { unflatten, type UserSettingValues } from '../settings';

export interface UserSettingsRecord {
  id: string;
  [field: string]: unknown;
}

export const USER_SETTINGS_QUERY_KEY = ['user-settings'] as const;

export interface UseUserSettingsResult {
  values: UserSettingValues;
  record: UserSettingsRecord | null;
  isLoading: boolean;
  error: Error | null;
}

export function useUserSettings(): UseUserSettingsResult {
  const userId = aepbase.getCurrentUser()?.id ?? null;

  const query = useQuery({
    queryKey: [...USER_SETTINGS_QUERY_KEY, userId] as const,
    enabled: !!userId,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<UserSettingsRecord | null> => {
      if (!userId) return null;
      try {
        const list = await aepbase.list<UserSettingsRecord>(USER_PREFERENCES, {
          parent: [USERS, userId],
        });
        return list.length > 0 ? list[0] : null;
      } catch (error) {
        // 404 is the expected state when the resource definition hasn't
        // been registered yet (no admin creds in the Next.js env).
        if (error instanceof AepbaseError && error.code === 404) {
          return null;
        }
        logger.warn('Failed to fetch user-settings record', {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    },
  });

  const defs = getAllUserSettingDefs();
  const values = unflatten(query.data ?? null, defs);

  return {
    values,
    record: query.data ?? null,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}
