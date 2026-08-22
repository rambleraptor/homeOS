/**
 * The signed-in user's delivery queue.
 *
 * Scheduled notifications are children of users
 * (`/users/{id}/scheduled-notifications`), so the URL implies the scope — there
 * is no filtering to do and no way to see somebody else's.
 */

import { useQuery } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { USERS } from '@rambleraptor/homestead-core/resources/builtins';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { SCHEDULED_NOTIFICATIONS } from '../constants';
import type { ScheduledNotification } from '../types';

/** One cache slot, separate from the inbox list under the same app id. */
export const scheduledQueryKey = queryKeys
  .app('notifications')
  .resource('scheduled-notification')
  .list();

export async function fetchScheduledNotifications(): Promise<ScheduledNotification[]> {
  const userId = aepbase.getCurrentUser()?.id;
  if (!userId) return [];
  const list = await aepbase.list<ScheduledNotification>(SCHEDULED_NOTIFICATIONS, {
    parent: [USERS, userId],
  });
  // Soonest first — the queue reads forwards in time, unlike the inbox.
  return list.sort((a, b) => (a.send_at || '').localeCompare(b.send_at || ''));
}

export function useScheduledNotifications() {
  return useQuery({
    queryKey: scheduledQueryKey,
    queryFn: fetchScheduledNotifications,
  });
}
