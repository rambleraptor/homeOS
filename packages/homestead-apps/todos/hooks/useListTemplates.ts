import { useResourceList } from '@rambleraptor/homestead-core/api/resourceHooks';
import { LIST_TEMPLATES } from '../resources';
import type { ListTemplate } from '../types';

export function useListTemplates() {
  return useResourceList<ListTemplate>('todos', 'list-template', LIST_TEMPLATES, {
    orderBy: 'create_time',
  });
}
