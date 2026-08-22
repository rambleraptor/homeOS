/**
 * Create / update / cancel for the signed-in user's own scheduled
 * notifications.
 *
 * All three write under `/users/{me}/…`, which is the only subtree the browser
 * can reach (`checkUserScope` denies the rest). Scheduling something for
 * somebody else is a server-side operation and deliberately has no client path
 * — see the design doc's §7.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { USERS } from '@rambleraptor/homestead-core/resources/builtins';
import { SCHEDULED_NOTIFICATIONS } from '../constants';
import { scheduledQueryKey } from './useScheduledNotifications';
import type {
  ScheduledNotification,
  ScheduledNotificationFormData,
} from '../types';

function currentUserId(): string {
  const userId = aepbase.getCurrentUser()?.id;
  if (!userId) throw new Error('User not authenticated');
  return userId;
}

export function useScheduleNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ScheduledNotificationFormData) =>
      aepbase.create<ScheduledNotification>(
        SCHEDULED_NOTIFICATIONS,
        { ...data, status: 'scheduled' },
        { parent: [USERS, currentUserId()] },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduledQueryKey });
    },
  });
}

export function useUpdateScheduledNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<ScheduledNotificationFormData>;
    }) =>
      aepbase.update<ScheduledNotification>(SCHEDULED_NOTIFICATIONS, id, data, {
        parent: [USERS, currentUserId()],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduledQueryKey });
    },
  });
}

/**
 * Cancel one. A status change rather than a delete: a row an app raised would
 * be recreated by that app's next reconcile if it simply vanished, so the row
 * stays as its own tombstone. That makes cancelling an app's notification
 * ("not this week's bin night") actually stick.
 */
export function useCancelScheduledNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      aepbase.update<ScheduledNotification>(
        SCHEDULED_NOTIFICATIONS,
        id,
        { status: 'canceled' },
        { parent: [USERS, currentUserId()] },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduledQueryKey });
    },
  });
}
