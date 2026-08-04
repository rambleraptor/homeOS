/**
 * Deletes a project. Member todos fall back to the main project: PATCH each
 * todo to clear `project`, `in_main`, and `category` first, then DELETE the
 * project record (force-cascading its categories). Ordering matters — if a
 * todo PATCH fails we leave the project intact rather than orphaning todos
 * with a dangling `project` reference. Clearing `category` here also avoids a
 * dangling category pointer, since categories live on the project and go with
 * it.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { PROJECTS, TODOS } from '../resources';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import type { Todo } from '../types';

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string): Promise<void> => {
      const projectRef = `projects/${projectId}`;
      const todos = await aepbase.list<Todo>(TODOS);
      const members = todos.filter((t) => t.project === projectRef);
      await Promise.all(
        members.map((t) =>
          aepbase.update<Todo>(TODOS, t.id, {
            project: '',
            in_main: false,
            category: '',
          }),
        ),
      );
      // Force-cascade so the project's category children are removed with it.
      await aepbase.remove(PROJECTS, projectId, { force: true });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.app('todos').all(),
      });
      await queryClient.refetchQueries({
        queryKey: queryKeys.app('todos').all(),
      });
    },
    onError: (error) => logger.error('Project delete mutation error', error),
  });
}
