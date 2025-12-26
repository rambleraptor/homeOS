import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getCollection, Collections } from '@/core/api/pocketbase';
import { queryKeys } from '@/core/api/queryClient';
import type { Person, PersonFormData } from '../types';
import { syncPartnerRelationship } from '../utils/partnerSync';

interface UpdatePersonData {
  id: string;
  data: PersonFormData;
}

export function useUpdatePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: UpdatePersonData) => {
      console.log('[useUpdatePerson] mutationFn called with:', { id, data });

      // Fetch current person data to know old partner_id
      const peopleCollection = getCollection<Person>(Collections.PEOPLE);
      const oldPerson = await peopleCollection.getOne(id);

      // Update the person
      const person = await peopleCollection.update(id, data);
      console.log('[useUpdatePerson] Update successful:', person);

      // Sync partner relationship and shared fields if partner changed or shared fields changed
      const partnerChanged = oldPerson.partner_id !== person.partner_id;
      const hasPartner = !!person.partner_id;

      if (partnerChanged || hasPartner) {
        await syncPartnerRelationship(
          person.id,
          person.partner_id,
          oldPerson.partner_id,
          {
            address: data.address,
            anniversary: data.anniversary,
          }
        );
      }

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
