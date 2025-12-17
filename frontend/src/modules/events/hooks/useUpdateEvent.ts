import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getCollection, Collections } from '@/core/api/pocketbase';
import { queryKeys } from '@/core/api/queryClient';
import type { Event, EventFormData } from '../types';

interface UpdateEventData {
  id: string;
  data: EventFormData;
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: UpdateEventData) => {
      console.log('[useUpdateEvent] mutationFn called with:', { id, data });
      const event = await getCollection<Event>(Collections.EVENTS).update(id, data);
      console.log('[useUpdateEvent] Update successful:', event);
      return event;
    },
    onSuccess: (_, variables) => {
      console.log('[useUpdateEvent] onSuccess called, invalidating queries');
      queryClient.invalidateQueries({
        queryKey: queryKeys.module('events').list(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.module('events').detail(variables.id),
      });
    },
    onError: (error) => {
      console.error('[useUpdateEvent] onError called:', error);
    },
  });
}
