import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { USERS } from '@rambleraptor/homestead-core/resources/builtins';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // A user owns child resources (notifications, preferences,
      // subscriptions); force-cascade so deletion doesn't 409 on them.
      await aepbase.remove(USERS, id, { force: true });
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.all() });
    },
  });
}
