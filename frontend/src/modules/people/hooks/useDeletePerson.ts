import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getCollection, Collections } from '@/core/api/pocketbase';
import { queryKeys } from '@/core/api/queryClient';
import { logger } from '@/core/utils/logger';
import { deleteRecurringNotificationsForPerson } from '../utils/notificationSync';

export function useDeletePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Delete recurring notifications for this person (non-blocking)
      // This is a best-effort operation - if it fails, we still want to delete the person
      try {
        await deleteRecurringNotificationsForPerson(id);
      } catch (syncError) {
        logger.error('Failed to delete recurring notifications', syncError, { personId: id });
        // Don't throw - notification cleanup failure shouldn't block person deletion
      }
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
