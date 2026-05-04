import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { TODOS } from '../resources';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import type { Todo, TodoFormData } from '../types';

export interface CreateTodoInput extends TodoFormData {
  /** When set, the todo is created inside this project; otherwise it lives on main. */
  projectId?: string;
}

export function useCreateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTodoInput): Promise<Todo> => {
      const userId = aepbase.getCurrentUser()?.id;
      const createdBy = userId ? `users/${userId}` : undefined;
      return aepbase.create<Todo>(TODOS, {
        title: data.title,
        status: 'pending',
        ...(createdBy ? { created_by: createdBy } : {}),
        ...(data.projectId ? { project: `projects/${data.projectId}` } : {}),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.module('todos').all(),
      });
      await queryClient.refetchQueries({
        queryKey: queryKeys.module('todos').all(),
      });
    },
    onError: (error) => logger.error('Todo create mutation error', error),
  });
}
