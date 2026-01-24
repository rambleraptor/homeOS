import { useQuery } from '@tanstack/react-query';
import { getCollection, pb, Collections } from '@/core/api/pocketbase';
import { queryKeys } from '@/core/api/queryClient';
import type { RecurringNotification } from '../types';

/**
 * Fetch all recurring notifications for a specific source record.
 *
 * @param sourceCollection - The collection name (e.g., "people")
 * @param sourceId - The ID of the source record
 */
export function useRecurringNotifications(
  sourceCollection: string,
  sourceId: string
) {
  return useQuery({
    queryKey: queryKeys
      .module(Collections.RECURRING_NOTIFICATIONS)
      .detail(`${sourceCollection}:${sourceId}`),
    queryFn: async () => {
      const userId = pb.authStore.record?.id;
      if (!userId || !sourceId) return [];

      const notifications = await getCollection<RecurringNotification>(
        Collections.RECURRING_NOTIFICATIONS
      ).getFullList({
        sort: 'reference_date_field,timing',
        filter: `user_id="${userId}" && source_collection="${sourceCollection}" && source_id="${sourceId}"`,
      });

      return notifications;
    },
    enabled: !!sourceId,
  });
}

/**
 * Fetch all recurring notifications for the current user.
 */
export function useAllRecurringNotifications() {
  return useQuery({
    queryKey: queryKeys.module(Collections.RECURRING_NOTIFICATIONS).list(),
    queryFn: async () => {
      const userId = pb.authStore.record?.id;
      if (!userId) return [];

      const notifications = await getCollection<RecurringNotification>(
        Collections.RECURRING_NOTIFICATIONS
      ).getFullList({
        sort: '-created',
        filter: `user_id="${userId}"`,
      });

      return notifications;
    },
  });
}
