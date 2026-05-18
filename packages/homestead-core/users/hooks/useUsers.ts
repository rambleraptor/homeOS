import { useQuery } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { USERS } from '@rambleraptor/homestead-core/resources/builtins';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import { ACCOUNT_TAGS } from '../resources';
import type { ManagedUser } from '../types';

interface AccountTagRecord {
  id: string;
  name: string;
}

async function fetchTagsForUser(userId: string): Promise<string[]> {
  try {
    const records = await aepbase.list<AccountTagRecord>(ACCOUNT_TAGS, {
      parent: [USERS, userId],
    });
    return records.map((r) => r.name).filter((n): n is string => !!n);
  } catch (error) {
    // Per-user failures shouldn't blank the list; surface and continue.
    logger.warn('Failed to fetch account tags for user', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: async (): Promise<ManagedUser[]> => {
      const users = await aepbase.list<ManagedUser>(USERS);
      const tagLists = await Promise.all(
        users.map((u) => fetchTagsForUser(u.id)),
      );
      const merged: ManagedUser[] = users.map((u, i) => ({
        ...u,
        tags: tagLists[i].length > 0 ? tagLists[i] : undefined,
      }));
      merged.sort((a, b) => a.email.localeCompare(b.email));
      return merged;
    },
  });
}
