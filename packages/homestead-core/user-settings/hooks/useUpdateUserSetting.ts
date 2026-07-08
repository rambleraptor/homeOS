/**
 * Upsert a single per-user setting on the signed-in user's
 * `user-preference` record.
 *
 * Internal plumbing — components should use `useUserSetting`. The
 * mutation flattens `(appId, key)` into the aepbase field name,
 * then either PATCHes the existing record or POSTs a new one if none
 * exists yet (`useUpdateMapProvider` previously did the same dance).
 *
 * If the `user-preference` resource definition hasn't been registered
 * in aepbase yet (e.g. the Next.js server booted without
 * `AEPBASE_ADMIN_EMAIL` / `AEPBASE_ADMIN_PASSWORD`), the first request
 * 404s. We recover by re-running the schema sync with the caller's
 * token and retrying — same pattern as `useUpdateAppFlag`.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aepbase, AepbaseError } from '@rambleraptor/homestead-core/api/aepbase';
import {
  USERS,
  USER_PREFERENCES,
} from '@rambleraptor/homestead-core/resources/builtins';
import { useAuth } from '@rambleraptor/homestead-core/auth/useAuth';
import { getAllUserSettingDefs } from '@rambleraptor/homestead-core/apps/registry';
import type { UserSettingValue } from '@rambleraptor/homestead-core/apps/types';
import { fieldName } from '../settings';
import { syncUserSettingsSchema } from '../sync';
import {
  USER_SETTINGS_QUERY_KEY,
  type UserSettingsRecord,
} from './useUserSettings';

export interface UpdateUserSettingArgs {
  appId: string;
  key: string;
  value: UserSettingValue;
}

async function upsertUserSetting(
  userId: string,
  payload: Record<string, UserSettingValue>,
): Promise<UserSettingsRecord> {
  const parent = [USERS, userId];
  const existing = await aepbase.list<UserSettingsRecord>(USER_PREFERENCES, {
    parent,
  });
  if (existing.length > 0) {
    return await aepbase.update<UserSettingsRecord>(
      USER_PREFERENCES,
      existing[0].id,
      payload,
      { parent },
    );
  }
  return await aepbase.create<UserSettingsRecord>(
    USER_PREFERENCES,
    payload,
    { parent },
  );
}

export function useUpdateUserSetting() {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();

  return useMutation({
    mutationFn: async ({ appId, key, value }: UpdateUserSettingArgs) => {
      const userId = aepbase.getCurrentUser()?.id;
      if (!userId) throw new Error('User not authenticated');

      const flat = fieldName(appId, key);
      const payload = { [flat]: value };

      try {
        return await upsertUserSetting(userId, payload);
      } catch (error) {
        if (!(error instanceof AepbaseError) || error.code !== 404) {
          throw error;
        }
        await syncUserSettingsSchema({
          aepbaseUrl: '/api/v1/aep',
          token: aepbase.authStore.token,
          defs: getAllUserSettingDefs(),
        });
        return await upsertUserSetting(userId, payload);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: USER_SETTINGS_QUERY_KEY,
      });
      // Several consumers (e.g. PersonCard, mapUtils) read settings
      // off the hydrated `User` object, so refresh that snapshot too.
      await refreshUser();
    },
  });
}
