import { useQuery } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { USERS } from '@rambleraptor/homestead-core/resources/builtins';
import { NOTIFICATION_SUBSCRIPTIONS } from '@rambleraptor/homestead-core/notifications/constants';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import type { NotificationSubscription } from '../types';

export interface AepNotificationSubscription extends NotificationSubscription {
  path: string;
  create_time: string;
  update_time: string;
}

/** Shared cache key so the update/delete mutations can invalidate this list. */
export const notificationSubscriptionsKey = queryKeys
  .app('settings')
  .list({ type: 'notification-subscription' });

/**
 * All of the current user's registered push subscriptions — one per device.
 * The settings screen lists these so a user can send a targeted test to, or
 * deregister, an individual device.
 */
export function useNotificationSubscriptions() {
  return useQuery({
    queryKey: notificationSubscriptionsKey,
    queryFn: async (): Promise<AepNotificationSubscription[]> => {
      try {
        const userId = aepbase.getCurrentUser()?.id;
        if (!userId) return [];
        return await aepbase.list<AepNotificationSubscription>(
          NOTIFICATION_SUBSCRIPTIONS,
          { parent: [USERS, userId] },
        );
      } catch (error) {
        logger.error('Failed to fetch notification subscriptions', error);
        return [];
      }
    },
  });
}
