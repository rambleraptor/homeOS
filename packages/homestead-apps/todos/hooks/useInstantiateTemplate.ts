/**
 * Instantiates a list template into a brand-new project: creates the project,
 * then adds a `pending` todo for every item in the template. Returns the new
 * project so the caller can switch the active scope to it.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import { LIST_TEMPLATES, PROJECTS, TEMPLATE_ITEMS, TODOS } from '../resources';
import type { Project, TemplateItem, Todo } from '../types';

interface InstantiateTemplateParams {
  templateId: string;
  /** Name for the new project. Defaults to the template's name. */
  name: string;
}

export function useInstantiateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      templateId,
      name,
    }: InstantiateTemplateParams): Promise<Project> => {
      const items = await aepbase.list<TemplateItem>(TEMPLATE_ITEMS, {
        parent: [LIST_TEMPLATES, templateId],
        orderBy: 'create_time',
      });
      const project = await aepbase.create<Project>(PROJECTS, { name });
      const projectRef = `projects/${project.id}`;
      // Create sequentially so the todos keep the template's item order
      // (create_time is the list sort key).
      for (const item of items) {
        await aepbase.create<Todo>(TODOS, {
          title: item.title,
          status: 'pending',
          project: projectRef,
        });
      }
      return project;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.app('todos').all(),
      });
    },
    onError: (error) => logger.error('Template instantiate error', error),
  });
}
