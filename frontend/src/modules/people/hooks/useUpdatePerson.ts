import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getCollection, Collections } from '@/core/api/pocketbase';
import { queryKeys } from '@/core/api/queryClient';
import type { Person, PersonFormData } from '../types';

interface UpdatePersonData {
  id: string;
  data: PersonFormData;
}

export function useUpdatePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: UpdatePersonData) => {
      console.log('[useUpdatePerson] mutationFn called with:', { id, data });
      const person = await getCollection<Person>(Collections.PEOPLE).update(id, data);
      console.log('[useUpdatePerson] Update successful:', person);
      return person;
    },
    onSuccess: (_, variables) => {
      console.log('[useUpdatePerson] onSuccess called, invalidating queries');
      queryClient.invalidateQueries({
        queryKey: queryKeys.module('people').list(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.module('people').detail(variables.id),
      });
    },
    onError: (error) => {
      console.error('[useUpdatePerson] onError called:', error);
    },
  });
}
