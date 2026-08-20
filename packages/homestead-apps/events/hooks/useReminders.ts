import { useResourceList } from '@rambleraptor/homestead-core/api/resourceHooks';
import { REMINDERS } from '../resources';
import type { Reminder } from '../types';

/**
 * Every standalone reminder, soonest-due first. `due_at` is RFC3339, which
 * sorts lexically, so the wire ordering and the client-side comparator the
 * hook derives from it agree — an optimistic row lands in the right place
 * before the refetch confirms it.
 */
export function useReminders() {
  return useResourceList<Reminder>('events', 'reminder', REMINDERS, {
    orderBy: 'due_at',
  });
}
