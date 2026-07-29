import { useResourceList } from '@rambleraptor/homestead-core/api/resourceHooks';
import { EVENTS } from '../resources';
import type { Event } from '../types';

export function useEvents() {
  return useResourceList<Event>('events', 'event', EVENTS, {
    sort: (a, b) => (a.name || '').localeCompare(b.name || ''),
  });
}
