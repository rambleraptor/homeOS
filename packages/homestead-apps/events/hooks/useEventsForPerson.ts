/**
 * Returns the events that reference a given person, sorted by their next
 * upcoming occurrence. Used by the people app to surface birthdays and
 * anniversaries on a person's card without re-modeling those dates on the
 * Person resource itself.
 */

import { useMemo } from 'react';
import { useEvents } from './useEvents';
import { hasEventDate, nextOccurrence } from '../utils/eventDate';
import type { Event } from '../types';

const PERSON_REF_PREFIX = 'people/';

function personIdFromRef(ref: string): string {
  return ref.startsWith(PERSON_REF_PREFIX)
    ? ref.slice(PERSON_REF_PREFIX.length)
    : ref;
}

export function useEventsForPerson(personId: string | undefined): Event[] {
  const { data: events } = useEvents();
  return useMemo(() => {
    if (!personId || !events) return [];
    const matching = events.filter((event) =>
      (event.people ?? []).some((ref) => personIdFromRef(ref) === personId),
    );
    return matching.sort((a, b) => {
      if (!hasEventDate(a) || !hasEventDate(b)) return 0;
      return nextOccurrence(a).getTime() - nextOccurrence(b).getTime();
    });
  }, [events, personId]);
}
