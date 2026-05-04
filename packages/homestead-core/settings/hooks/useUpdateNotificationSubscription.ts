import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { USERS } from '@rambleraptor/homestead-core/resources/builtins';
import { NOTIFICATION_SUBSCRIPTIONS } from '@rambleraptor/homestead-core/notifications/constants';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import type { NotificationSubscription } from '../types';

interface UpdateSubscriptionData {
  subscription: PushSubscription;
  enabled: boolean;
}

interface AepNotificationSubscription extends NotificationSubscription {
  path: string;
  create_time: string;
  update_time: string;
}

export function useUpdateNotificationSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateSubscriptionData) => {
      const userId = aepbase.getCurrentUser()?.id;
      if (!userId) throw new Error('User not authenticated');

      const parent = [USERS, userId];
      const existing = await aepbase.list<AepNotificationSubscription>(
        NOTIFICATION_SUBSCRIPTIONS,
        { parent },
      );

      if (existing.length > 0) {
        return await aepbase.update<AepNotificationSubscription>(
          NOTIFICATION_SUBSCRIPTIONS,
          existing[0].id,
          { subscription_data: data.subscription, enabled: data.enabled },
          { parent },
        );
      }
      return await aepbase.create<AepNotificationSubscription>(
        NOTIFICATION_SUBSCRIPTIONS,
        {
          user_id: userId,
          subscription_data: data.subscription,
          enabled: data.enabled,
        },
        { parent },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.module('settings').list({ type: 'notification-subscription' }),
      });
    },
  });
}
