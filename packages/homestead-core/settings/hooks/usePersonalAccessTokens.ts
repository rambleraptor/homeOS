import { useQuery } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import {
  USERS,
  PERSONAL_ACCESS_TOKENS,
} from '@rambleraptor/homestead-core/resources/builtins';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { logger } from '@rambleraptor/homestead-core/utils/logger';

/** One scope granted to a token — a capability over a target. */
export interface TokenScope {
  capability: 'read' | 'write' | 'manage';
  target_scope: 'all' | 'app' | 'collection';
  target_app?: string;
  resource_type?: string;
}

/** A personal access token record (non-secret metadata only). */
export interface AepPersonalAccessToken {
  id: string;
  path: string;
  name: string;
  token_prefix?: string;
  expires_at?: string;
  last_used_at?: string;
  scopes?: TokenScope[];
  create_time: string;
  update_time: string;
}

/** Shared cache key so the mint/revoke mutations can invalidate this list. */
export const personalAccessTokensKey = queryKeys
  .app('settings')
  .list({ type: 'personal-access-token' });

/** Every personal access token the current user has issued. */
export function usePersonalAccessTokens() {
  return useQuery({
    queryKey: personalAccessTokensKey,
    queryFn: async (): Promise<AepPersonalAccessToken[]> => {
      try {
        const userId = aepbase.getCurrentUser()?.id;
        if (!userId) return [];
        return await aepbase.list<AepPersonalAccessToken>(PERSONAL_ACCESS_TOKENS, {
          parent: [USERS, userId],
        });
      } catch (error) {
        logger.error('Failed to fetch personal access tokens', error);
        return [];
      }
    },
  });
}
