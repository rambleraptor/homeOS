import { useResourceUpdate } from '@rambleraptor/homestead-core/api/resourceHooks';
import type { Reminder, ReminderFormData } from '../types';

export function useUpdateReminder() {
  return useResourceUpdate<Reminder, Partial<ReminderFormData>>('events', 'reminder');
}
