import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { USERS } from '@rambleraptor/homestead-core/resources/builtins';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { PERSONAL_TODOS } from '../resources';
import type { PersonalTodo } from '../types';

interface UpdatePersonalTodoVars {
  id: string;
  data: Partial<Pick<PersonalTodo, 'title' | 'status'>>;
}

/**
 * Update a private todo under `/users/{me}/personal-todos/{id}`. See
 * {@link useCreatePersonalTodo} for why user-parented writes go through the
 * raw client with an explicit parent rather than the generic wrapper.
 */
export function useUpdatePersonalTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: UpdatePersonalTodoVars) => {
      const userId = aepbase.getCurrentUser()?.id;
      if (!userId) throw new Error('User not authenticated');
      return aepbase.update<PersonalTodo>(
        PERSONAL_TODOS,
        id,
        data as Record<string, unknown>,
        { parent: [USERS, userId] },
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.app('todos').all() }),
  });
}
