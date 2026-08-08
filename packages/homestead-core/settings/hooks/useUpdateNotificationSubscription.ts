import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { USERS } from '@rambleraptor/homestead-core/resources/builtins';
import { NOTIFICATION_SUBSCRIPTIONS } from '@rambleraptor/homestead-core/notifications/constants';
import {
  notificationSubscriptionsKey,
  type AepNotificationSubscription,
} from './useNotificationSubscriptions';

interface UpdateSubscriptionData {
  subscription: PushSubscription;
  enabled: boolean;
  deviceLabel?: string;
}

/**
 * Register (or refresh) the push subscription for the *current* device.
 *
 * A user can have many subscriptions — one per browser/device — so we dedup by
 * the push `endpoint`: if a record for this endpoint already exists we patch it
 * in place, otherwise we create a new one. This keeps re-subscribing on the
 * same device from piling up duplicate rows.
 */
export function useUpdateNotificationSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    // SettingsHome wraps browser push-subscription steps around this write and
    // shows its own message, so skip the global mutation error toast here.
    meta: { skipErrorToast: true },
    mutationFn: async (data: UpdateSubscriptionData) => {
      const userId = aepbase.getCurrentUser()?.id;
      if (!userId) throw new Error('User not authenticated');

      const parent = [USERS, userId];
      const subscriptionJson = data.subscription.toJSON();
      const endpoint = data.subscription.endpoint;

      const existing = await aepbase.list<AepNotificationSubscription>(
        NOTIFICATION_SUBSCRIPTIONS,
        { parent },
      );
      const match = existing.find(
        (sub) => sub.subscription_data?.endpoint === endpoint,
      );

      if (match) {
        return await aepbase.update<AepNotificationSubscription>(
          NOTIFICATION_SUBSCRIPTIONS,
          match.id,
          {
            subscription_data: subscriptionJson,
            enabled: data.enabled,
            ...(data.deviceLabel ? { device_label: data.deviceLabel } : {}),
          },
          { parent },
        );
      }
      return await aepbase.create<AepNotificationSubscription>(
        NOTIFICATION_SUBSCRIPTIONS,
        {
          user_id: userId,
          subscription_data: subscriptionJson,
          enabled: data.enabled,
          ...(data.deviceLabel ? { device_label: data.deviceLabel } : {}),
        },
        { parent },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationSubscriptionsKey });
    },
  });
}
