import { useResourceCreate } from '@rambleraptor/homestead-core/api/resourceHooks';
import type { Reminder, ReminderFormData } from '../types';

export function useCreateReminder() {
  return useResourceCreate<Reminder, ReminderFormData>('events', 'reminder');
}
