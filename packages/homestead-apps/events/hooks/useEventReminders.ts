/**
 * The current user's event reminder preferences.
 *
 * Reminders are children of users in aepbase
 * (`/users/{id}/event-reminders`), so the URL implies the user scope and one
 * household member never sees another's choices. Only events a user actively
 * opted into have a record — everything else is "no reminder" by omission.
 */

import { useQuery } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { USERS } from '@rambleraptor/homestead-core/resources/builtins';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { EVENT_REMINDERS } from '../resources';
import type { EventReminder } from '../types';

const APP_ID = 'events';

/** Stable key for the current user's reminder list. */
export const eventRemindersKey = queryKeys.app(APP_ID).list({ type: 'reminders' });

export async function fetchEventReminders(): Promise<EventReminder[]> {
  const userId = aepbase.getCurrentUser()?.id;
  if (!userId) return [];
  return aepbase.list<EventReminder>(EVENT_REMINDERS, {
    parent: [USERS, userId],
  });
}

export function useEventReminders() {
  return useQuery({
    queryKey: eventRemindersKey,
    queryFn: fetchEventReminders,
  });
}
