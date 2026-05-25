import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { client } from '@rambleraptor/homestead-core/api/client';
import type { Project } from '../types';

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.module('todos').resource('project').list(),
    queryFn: async (): Promise<Project[]> => {
      const projects = await client.projects.list();
      return projects.sort((a, b) =>
        (a.create_time || '').localeCompare(b.create_time || ''),
      );
    },
  });
}
