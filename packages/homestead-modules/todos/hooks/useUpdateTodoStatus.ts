import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { TODOS } from '../resources';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import type { Todo, TodoStatus } from '../types';

export function useUpdateTodoStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: TodoStatus;
    }): Promise<Todo> => {
      return aepbase.update<Todo>(TODOS, id, { status });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.module('todos').all(),
      });
      await queryClient.refetchQueries({
        queryKey: queryKeys.module('todos').all(),
      });
    },
    onError: (error) => logger.error('Todo status update error', error),
  });
}
