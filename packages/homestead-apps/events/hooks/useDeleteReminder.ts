import { useResourceDelete } from '@rambleraptor/homestead-core/api/resourceHooks';

export function useDeleteReminder() {
  return useResourceDelete('events', 'reminder');
}
