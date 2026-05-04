/**
 * Resets every non-pending todo in the active scope back to `pending`. The
 * action is scope-aware so the per-project view's reset button only touches
 * that project's bucket.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { TODOS } from '../resources';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import { MAIN_PROJECT_ID, type ProjectScope, type Todo } from '../types';
import { filterTodosForScope } from './useTodos';

export function useResetTodos(scope: ProjectScope = MAIN_PROJECT_ID) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<number> => {
      const todos = await aepbase.list<Todo>(TODOS);
      const inScope = filterTodosForScope(todos, scope);
      const stale = inScope.filter((t) => t.status !== 'pending');
      await Promise.all(
        stale.map((t) =>
          aepbase.update<Todo>(TODOS, t.id, {
            status: 'pending',
          }),
        ),
      );
      return stale.length;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.module('todos').all(),
      });
      await queryClient.refetchQueries({
        queryKey: queryKeys.module('todos').all(),
      });
    },
    onError: (error) => logger.error('Todo reset error', error),
  });
}
