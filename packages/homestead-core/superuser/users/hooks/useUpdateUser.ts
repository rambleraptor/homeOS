import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { USERS } from '@rambleraptor/homestead-core/resources/builtins';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { useAuth } from '@rambleraptor/homestead-core/auth/useAuth';
import type { ManagedUser, UserFormData } from '../types';

interface UpdateArgs {
  id: string;
  data: Partial<UserFormData>;
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
      return hasUserBody
        ? await aepbase.update<ManagedUser>(USERS, id, body)
        : await aepbase.get<ManagedUser>(USERS, id);
    },
    onSuccess: async (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.users.all() });
      // If the edited user is the signed-in user, re-hydrate the auth store so
      // server-derived fields reflect the change without a re-login.
      if (currentUser && currentUser.id === vars.id) {
        await refreshUser();
      }
    },
  });
}
