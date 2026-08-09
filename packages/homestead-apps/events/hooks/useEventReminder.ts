/**
 * Read + write the current user's reminder preference for a single event.
 *
 * Models the stored data (an `event-reminder` record, or its absence) as a
 * four-way choice — `none` | `day_of` | `week_before` | `both` — so one control
 * can turn a reminder on, off, or switch its lead time:
 *   - `none`  → delete the record (absence is the default)
 *   - others  → upsert the record with that `lead`
 */

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { USERS } from '@rambleraptor/homestead-core/resources/builtins';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { EVENT_REMINDERS } from '../resources';
import { useEventReminders } from './useEventReminders';
import type { EventReminder, ReminderChoice } from '../types';

const APP_ID = 'events';

export interface UseEventReminderResult {
  choice: ReminderChoice;
  isLoading: boolean;
  isSaving: boolean;
  setChoice: (choice: ReminderChoice) => Promise<void>;
}

export function useEventReminder(eventId: string): UseEventReminderResult {
  const queryClient = useQueryClient();
  const { data: reminders = [], isLoading } = useEventReminders();
  const existing = reminders.find((r) => r.event_id === eventId);

  const mutation = useMutation({
    mutationFn: async (choice: ReminderChoice) => {
      const userId = aepbase.getCurrentUser()?.id;
      if (!userId) throw new Error('User not authenticated');
      const parent = { parent: [USERS, userId] };
      if (choice === 'none') {
        if (existing) await aepbase.remove(EVENT_REMINDERS, existing.id, parent);
        return;
      }
      if (existing) {
        await aepbase.update<EventReminder>(
          EVENT_REMINDERS,
          existing.id,
          { lead: choice },
          parent,
        );
      } else {
        await aepbase.create<EventReminder>(
          EVENT_REMINDERS,
          { event_id: eventId, lead: choice },
          parent,
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.app(APP_ID).all() });
    },
  });

  const setChoice = useCallback(
    async (choice: ReminderChoice) => {
      await mutation.mutateAsync(choice);
    },
    [mutation],
  );

  return {
    choice: existing?.lead ?? 'none',
    isLoading,
    isSaving: mutation.isPending,
    setChoice,
  };
}
