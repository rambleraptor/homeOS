import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { USERS } from '@rambleraptor/homestead-core/resources/builtins';
import { NOTIFICATION_SUBSCRIPTIONS } from '@rambleraptor/homestead-core/notifications/constants';
import { notificationSubscriptionsKey } from './useNotificationSubscriptions';

/**
 * Deregister a single device by its subscription id. The caller (SettingsHome)
 * is responsible for browser-unsubscribing first when the id belongs to the
 * current device.
 */
export function useDeleteNotificationSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    // SettingsHome wraps browser push-unsubscribe steps around this write and
    // shows its own message, so skip the global mutation error toast here.
    meta: { skipErrorToast: true },
    mutationFn: async (subscriptionId: string) => {
      const userId = aepbase.getCurrentUser()?.id;
      if (!userId) throw new Error('User not authenticated');
      await aepbase.remove(NOTIFICATION_SUBSCRIPTIONS, subscriptionId, {
        parent: [USERS, userId],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationSubscriptionsKey });
    },
  });
}
