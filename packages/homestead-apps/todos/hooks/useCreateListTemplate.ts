import { useResourceCreate } from '@rambleraptor/homestead-core/api/resourceHooks';
import type { ListTemplate } from '../types';

export function useCreateListTemplate() {
  return useResourceCreate<ListTemplate, { name: string }>(
    'todos',
    'list-template',
  );
}
