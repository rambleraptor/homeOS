import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getCollection, Collections } from '@/core/api/pocketbase';
import { queryKeys } from '@/core/api/queryClient';
import { deleteRecurringNotificationsForPerson } from '../utils/notificationSync';

export function useDeletePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Delete recurring notifications for this person first
      await deleteRecurringNotificationsForPerson(id);
      // Then delete the person
      await getCollection(Collections.PEOPLE).delete(id);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.module('people').list(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.module(Collections.RECURRING_NOTIFICATIONS).list(),
      });
    },
  });
}
