import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { USERS } from '@rambleraptor/homestead-core/resources/builtins';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { useAuth } from '@rambleraptor/homestead-core/auth/useAuth';
import { ACCOUNT_TAGS } from '../resources';
import { accountTagsQueryKey } from './useAccountTags';
import type { ManagedUser, UserFormData } from '../types';

interface UpdateArgs {
  id: string;
  data: Partial<UserFormData>;
}

interface AccountTagRecord {
  id: string;
  name: string;
}

async function reconcileTags(userId: string, desiredTags: string[]) {
  const desired = new Set(
    desiredTags.map((t) => t.trim()).filter((t) => t.length > 0),
  );
  const existing = await aepbase.list<AccountTagRecord>(ACCOUNT_TAGS, {
    parent: [USERS, userId],
  });
  const have = new Map<string, AccountTagRecord>();
  for (const r of existing) have.set(r.name, r);

  const toCreate: string[] = [];
  for (const name of desired) {
    if (!have.has(name)) toCreate.push(name);
  }
  const toDelete: AccountTagRecord[] = [];
  for (const [name, record] of have) {
    if (!desired.has(name)) toDelete.push(record);
  }

  await Promise.all([
    ...toCreate.map((name) =>
      aepbase.create(
        ACCOUNT_TAGS,
        { name },
        { parent: [USERS, userId] },
      ),
    ),
    ...toDelete.map((r) =>
      aepbase.remove(ACCOUNT_TAGS, r.id, { parent: [USERS, userId] }),
    ),
  ]);
}

export function useUpdateUser() {
  const qc = useQueryClient();
  const { user: currentUser, refreshUser } = useAuth();
  return useMutation({
    mutationFn: async ({ id, data }: UpdateArgs) => {
      const body: Record<string, unknown> = {};
      if (data.email !== undefined) body.email = data.email;
      if (data.display_name !== undefined) body.display_name = data.display_name;
      if (data.type !== undefined) body.type = data.type;
      if (data.password) body.password = data.password;

      const hasUserBody = Object.keys(body).length > 0;
      const updated = hasUserBody
        ? await aepbase.update<ManagedUser>(USERS, id, body)
        : await aepbase.get<ManagedUser>(USERS, id);

      if (data.tags !== undefined) {
        await reconcileTags(id, data.tags);
      }

      return updated;
    },
    onSuccess: async (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.users.all() });
      qc.invalidateQueries({ queryKey: accountTagsQueryKey(vars.id) });
      // If the edited user is the signed-in user, re-hydrate the auth
      // store so `User.tags` (and any other server-derived fields)
      // reflect the change. Without this, the sidebar / app gates
      // keep seeing the stale tag list until the user signs back in.
      if (currentUser && currentUser.id === vars.id) {
        await refreshUser();
      }
    },
  });
}
