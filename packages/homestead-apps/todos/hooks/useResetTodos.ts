/**
 * Resets every non-pending todo in the active scope back to `pending`. The
 * action is scope-aware so the per-project view's reset button only touches
 * that project's bucket.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { USERS } from '@rambleraptor/homestead-core/resources/builtins';
import { PERSONAL_TODOS, TODOS } from '../resources';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import {
  MAIN_PROJECT_ID,
  type PersonalTodo,
  type ProjectScope,
  type Todo,
} from '../types';
import { filterTodosForScope } from './useTodos';

export function useResetTodos(scope: ProjectScope = MAIN_PROJECT_ID) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<number> => {
      // Family todos in scope. Resetting these is a household-wide side effect
      // (they're shared), matching the pre-existing behavior.
      const family = await aepbase.list<Todo>(TODOS);
      const staleFamily = filterTodosForScope(family, scope).filter(
        (t) => t.status !== 'pending',
      );
      const writes: Promise<unknown>[] = staleFamily.map((t) =>
        aepbase.update<Todo>(TODOS, t.id, { status: 'pending' }),
      );
      let count = staleFamily.length;

      // Personal todos only ever appear on the main view, so they're only in
      // scope there. They belong to the current user alone.
      if (scope === MAIN_PROJECT_ID) {
        const userId = aepbase.getCurrentUser()?.id;
        if (userId) {
          const parent = [USERS, userId];
          const personal = await aepbase.list<PersonalTodo>(PERSONAL_TODOS, {
            parent,
          });
          const stalePersonal = personal.filter((t) => t.status !== 'pending');
          writes.push(
            ...stalePersonal.map((t) =>
              aepbase.update<PersonalTodo>(
                PERSONAL_TODOS,
                t.id,
                { status: 'pending' },
                { parent },
              ),
            ),
          );
          count += stalePersonal.length;
        }
      }

      await Promise.all(writes);
      return count;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.app('todos').all(),
      });
      await queryClient.refetchQueries({
        queryKey: queryKeys.app('todos').all(),
      });
    },
    onError: (error) => logger.error('Todo reset error', error),
  });
}
