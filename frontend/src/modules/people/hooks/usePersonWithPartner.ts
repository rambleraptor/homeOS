import { useQuery } from '@tanstack/react-query';
import { getCollection, Collections } from '@/core/api/pocketbase';
import { queryKeys } from '@/core/api/queryClient';
import type { PersonWithPartner } from '../types';

/**
 * Hook to fetch a person with their partner data expanded.
 * Useful for displaying shared information (address, anniversary).
 */
export function usePersonWithPartner(id: string) {
  return useQuery({
    queryKey: [...queryKeys.module('people').detail(id), 'with-partner'],
    queryFn: async () => {
      const person = await getCollection<PersonWithPartner>(Collections.PEOPLE).getOne(id, {
        expand: 'partner_id',
      });
      return person;
    },
    enabled: !!id,
  });
}
