import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getCollection, getCurrentUser, Collections } from '@/core/api/pocketbase';
import { queryKeys } from '@/core/api/queryClient';
import type { Person, PersonFormData } from '../types';

export function useBulkImportPeople() {
  const queryClient = useQueryClient();
  const currentUser = getCurrentUser();

  return useMutation({
    mutationFn: async (people: PersonFormData[]) => {
      const promises = people.map((person) => {
        const data = {
          ...person,
          created_by: currentUser?.id,
        };
        return getCollection<Person>(Collections.PEOPLE).create(data);
      });

      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.module('people').list(),
      });
    },
  });
}