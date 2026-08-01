import { useQuery } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { USERS } from '@rambleraptor/homestead-core/resources/builtins';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import type { ManagedUser } from '../types';

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: async (): Promise<ManagedUser[]> => {
      const users = await aepbase.list<ManagedUser>(USERS);
      return [...users].sort((a, b) => a.email.localeCompare(b.email));
    },
  });
}
