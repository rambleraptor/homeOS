import { useResourceCreate } from '@rambleraptor/homestead-core/api/resourceHooks';
import type { Project } from '../types';

export function useCreateProject() {
  return useResourceCreate<Project, { name: string }>('todos', 'project');
}
