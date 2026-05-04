import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { TODOS } from '../resources';

export function useDeleteTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await aepbase.remove(TODOS, id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.module('todos').all(),
      });
      await queryClient.refetchQueries({
        queryKey: queryKeys.module('todos').all(),
      });
    },
  });
}
