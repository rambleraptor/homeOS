import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getCollection, pb, Collections } from '@/core/api/pocketbase';
import { queryKeys } from '@/core/api/queryClient';
import type {
  RecurringNotification,
  RecurringNotificationInput,
  NotificationTiming,
} from '../types';

/**
 * Create a new recurring notification.
 */
export function useCreateRecurringNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RecurringNotificationInput) => {
      const userId = pb.authStore.record?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const notification = await getCollection<RecurringNotification>(
        Collections.RECURRING_NOTIFICATIONS
      ).create({
        user_id: userId,
        source_collection: input.source_collection,
        source_id: input.source_id,
        title_template: input.title_template,
        message_template: input.message_template,
        reference_date_field: input.reference_date_field,
        timing: input.timing,
        enabled: input.enabled ?? true,
      });

      return notification;
    },
    onSuccess: (_, variables) => {
      // Invalidate both the specific source's notifications and the full list
      queryClient.invalidateQueries({
        queryKey: queryKeys
          .module(Collections.RECURRING_NOTIFICATIONS)
          .detail(`${variables.source_collection}:${variables.source_id}`),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.module(Collections.RECURRING_NOTIFICATIONS).list(),
      });
    },
  });
}

/**
 * Delete a recurring notification.
 */
export function useDeleteRecurringNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      sourceCollection,
      sourceId,
    }: {
      id: string;
      sourceCollection: string;
      sourceId: string;
    }) => {
      await getCollection<RecurringNotification>(
        Collections.RECURRING_NOTIFICATIONS
      ).delete(id);
      return { id, sourceCollection, sourceId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys
          .module(Collections.RECURRING_NOTIFICATIONS)
          .detail(`${result.sourceCollection}:${result.sourceId}`),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.module(Collections.RECURRING_NOTIFICATIONS).list(),
      });
    },
  });
}

/**
 * Update the enabled status of a recurring notification.
 */
export function useUpdateRecurringNotificationEnabled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      enabled,
      sourceCollection,
      sourceId,
    }: {
      id: string;
      enabled: boolean;
      sourceCollection: string;
      sourceId: string;
    }) => {
      const notification = await getCollection<RecurringNotification>(
        Collections.RECURRING_NOTIFICATIONS
      ).update(id, { enabled });
      return { notification, sourceCollection, sourceId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys
          .module(Collections.RECURRING_NOTIFICATIONS)
          .detail(`${result.sourceCollection}:${result.sourceId}`),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.module(Collections.RECURRING_NOTIFICATIONS).list(),
      });
    },
  });
}

/**
 * Bulk update recurring notifications for a source.
 * This will create/delete recurring notifications to match the desired timings.
 */
export function useSyncRecurringNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sourceCollection,
      sourceId,
      referenceDateField,
      titleTemplate,
      messageTemplate,
      desiredTimings,
    }: {
      sourceCollection: string;
      sourceId: string;
      referenceDateField: string;
      titleTemplate: string;
      messageTemplate: string;
      desiredTimings: NotificationTiming[];
    }) => {
      const userId = pb.authStore.record?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get existing recurring notifications for this source and field
      const existing = await getCollection<RecurringNotification>(
        Collections.RECURRING_NOTIFICATIONS
      ).getFullList({
        filter: `user_id="${userId}" && source_collection="${sourceCollection}" && source_id="${sourceId}" && reference_date_field="${referenceDateField}"`,
      });

      const existingTimings = new Set(existing.map((n) => n.timing));
      const desiredSet = new Set(desiredTimings);

      // Create missing
      for (const timing of desiredTimings) {
        if (!existingTimings.has(timing)) {
          await getCollection<RecurringNotification>(
            Collections.RECURRING_NOTIFICATIONS
          ).create({
            user_id: userId,
            source_collection: sourceCollection,
            source_id: sourceId,
            title_template: titleTemplate,
            message_template: messageTemplate,
            reference_date_field: referenceDateField,
            timing,
            enabled: true,
          });
        }
      }

      // Delete removed
      for (const notification of existing) {
        if (!desiredSet.has(notification.timing)) {
          await getCollection<RecurringNotification>(
            Collections.RECURRING_NOTIFICATIONS
          ).delete(notification.id);
        }
      }

      return { sourceCollection, sourceId, referenceDateField };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys
          .module(Collections.RECURRING_NOTIFICATIONS)
          .detail(`${result.sourceCollection}:${result.sourceId}`),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.module(Collections.RECURRING_NOTIFICATIONS).list(),
      });
    },
  });
}
