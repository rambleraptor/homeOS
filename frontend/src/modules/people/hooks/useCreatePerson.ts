import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getCollection, getCurrentUser, Collections } from '@/core/api/pocketbase';
import { queryKeys } from '@/core/api/queryClient';
import type { Person, PersonFormData } from '../types';

export function useCreatePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PersonFormData) => {
      try {
        const currentUser = getCurrentUser();
        const person = await getCollection<Person>(Collections.PEOPLE).create({
          ...data,
          created_by: currentUser?.id,
        });
        return person;
      } catch (error) {
        console.error('Failed to create person:', error);
        console.error('Person data:', data);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.module('people').list(),
      });
    },
    onError: (error) => {
      console.error('Mutation error:', error);
    },
  });
}
