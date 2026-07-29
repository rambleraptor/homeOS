import { useResourceList } from '@rambleraptor/homestead-core/api/resourceHooks';
import { EVENTS } from '../resources';
import type { Event } from '../types';

export function useEvents() {
  return useResourceList<Event>('events', 'event', {
    plural: EVENTS,
    orderBy: 'name',
  });
}
