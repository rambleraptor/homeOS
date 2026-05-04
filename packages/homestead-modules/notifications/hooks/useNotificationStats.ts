/**
 * Notification stats + shared fetcher.
 *
 * Notifications are children of users in aepbase
 * (`/users/{id}/notifications`), so the URL implies the user scope.
 */

import { useQuery } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { USERS } from '@rambleraptor/homestead-core/resources/builtins';
import { NOTIFICATIONS } from '../resources';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import type { Notification, NotificationStats } from '../types';

interface AepNotification extends Notification {
  path: string;
  create_time: string;
  update_time: string;
}

function normalize(rec: AepNotification): Notification {
  return {
    ...rec,
    created: rec.create_time || '',
    updated: rec.update_time || '',
  };
}

export async function fetchNotifications(): Promise<Notification[]> {
  const userId = aepbase.getCurrentUser()?.id;
  if (!userId) return [];
  const list = await aepbase.list<AepNotification>(NOTIFICATIONS, {
    parent: [USERS, userId],
  });
  return list
    .map(normalize)
    .sort((a, b) => (b.created || '').localeCompare(a.created || ''));
}

export function useNotificationStats() {
  return useQuery({
    queryKey: queryKeys.module('notifications').list(),
    queryFn: fetchNotifications,
    select: (notifications): NotificationStats => ({
      total: notifications.length,
      unread: notifications.filter((n) => !n.read).length,
      read: notifications.filter((n) => n.read).length,
    }),
  });
}
