import { useResourceList } from '@rambleraptor/homestead-core/api/resourceHooks';
import { PROJECTS } from '../resources';
import type { Project } from '../types';

export function useProjects() {
  return useResourceList<Project>('todos', 'project', {
    plural: PROJECTS,
    orderBy: 'create_time',
  });
}
