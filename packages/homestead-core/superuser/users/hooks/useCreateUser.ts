import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { USERS } from '@rambleraptor/homestead-core/resources/builtins';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import type { ManagedUser, UserFormData } from '../types';

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: UserFormData) => {
      if (!data.password) throw new Error('Password is required');
      return aepbase.create<ManagedUser>(USERS, {
        email: data.email,
        display_name: data.display_name,
        type: data.type,
        password: data.password,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.all() });
    },
  });
}
