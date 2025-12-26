import { useQuery } from '@tanstack/react-query';
import { getCollection, Collections } from '@/core/api/pocketbase';
import { queryKeys } from '@/core/api/queryClient';
import type { PersonWithPartner } from '../types';

export function usePeople() {
  return useQuery({
    queryKey: queryKeys.module('people').list(),
    queryFn: async () => {
      const people = await getCollection<PersonWithPartner>(Collections.PEOPLE).getFullList({
        sort: 'name',
        expand: 'partner_id',
      });
      return people;
    },
  });
}
