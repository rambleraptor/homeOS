/**
 * Deletes a project. Member todos fall back to the main project: PATCH each
 * todo to clear `project` and `in_main` first, then DELETE the project
 * record. Ordering matters — if a todo PATCH fails we leave the project
 * intact rather than orphaning todos with a dangling `project` reference.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { client } from '@rambleraptor/homestead-core/api/client';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import type { Todo } from '../types';

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string): Promise<void> => {
      const projectRef = `projects/${projectId}`;
      const todos = (await client.todos.list()) as unknown as Todo[];
      const members = todos.filter((t) => t.project === projectRef);
      await Promise.all(
        members.map((t) =>
          client.todos.update(t.id, { project: '', in_main: false }),
        ),
      );
      await client.projects.delete(projectId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.module('todos').all(),
      });
      await queryClient.refetchQueries({
        queryKey: queryKeys.module('todos').all(),
      });
    },
    onError: (error) => logger.error('Project delete mutation error', error),
  });
}
