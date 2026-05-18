import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { USERS } from '@rambleraptor/homestead-core/resources/builtins';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { ACCOUNT_TAGS } from '../resources';
import type { ManagedUser, UserFormData } from '../types';

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: UserFormData) => {
      if (!data.password) throw new Error('Password is required');
      const created = await aepbase.create<ManagedUser>(USERS, {
        email: data.email,
        display_name: data.display_name,
        type: data.type,
        password: data.password,
      });
      // Account tags live in a separate child resource. Create one
      // record per tag after the user exists. Failures here don't
      // roll back the user — they surface to the toast layer.
      const tags = (data.tags ?? []).map((t) => t.trim()).filter(Boolean);
      if (tags.length > 0) {
        await Promise.all(
          tags.map((name) =>
            aepbase.create(
              ACCOUNT_TAGS,
              { name },
              { parent: [USERS, created.id] },
            ),
          ),
        );
      }
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.all() });
    },
  });
}
