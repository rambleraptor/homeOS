import { useQuery } from '@tanstack/react-query';
import { getCollection, Collections } from '@/core/api/pocketbase';
import { queryKeys } from '@/core/api/queryClient';
import type { Person } from '../types';

export function usePersonById(id: string) {
  return useQuery({
    queryKey: queryKeys.module('people').detail(id),
    queryFn: async () => {
      const person = await getCollection<Person>(Collections.PEOPLE).getOne(id);
      return person;
    },
    enabled: !!id,
  });
}
