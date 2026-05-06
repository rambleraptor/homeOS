/**
 * Returns the events that reference a given person, sorted by their next
 * upcoming occurrence. Used by the people module to surface birthdays and
 * anniversaries on a person's card without re-modeling those dates on the
 * Person resource itself.
 */

import { useMemo } from 'react';
import {
  getNextEventOccurrence,
  parseDateString,
} from '@rambleraptor/homestead-core/shared/utils/dateUtils';
import { useEvents } from './useEvents';
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
      if (!a.date?.trim() || !b.date?.trim()) return 0;
      const aNext = getNextEventOccurrence(
        parseDateString(a.date),
        a.recurrence,
        a.recurrence_rule,
      );
      const bNext = getNextEventOccurrence(
        parseDateString(b.date),
        b.recurrence,
        b.recurrence_rule,
      );
      return aNext.getTime() - bNext.getTime();
    });
  }, [events, personId]);
}
