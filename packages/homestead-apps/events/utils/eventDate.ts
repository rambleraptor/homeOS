/**
 * Date helpers for the month/day(/optional-year) event model.
 *
 * Events store `month` + `day` (the recurrence anchor) and an optional `year`
 * (birth / wedding year, for an age or anniversary count). The recurrence
 * engine works in `Date`s and only ever reads a date's month and day, so we
 * build a throwaway anchor `Date` from month/day using a fixed reference year.
 * That reference year is compute-only — it is never stored, so no placeholder
 * year ever lands in the database.
 */

import { getNextEventOccurrence } from '@rambleraptor/homestead-core/shared/utils/dateUtils';
import type { Event } from '../types';

/** Compute-only anchor year. Never persisted. */
const REF_YEAR = 2000;

type DateParts = Pick<Event, 'month' | 'day'>;
type OccurrenceParts = DateParts & Pick<Event, 'recurrence' | 'recurrence_rule'>;

/** True when the event carries a usable month/day. */
export function hasEventDate(e: Partial<DateParts>): e is DateParts {
  return (
    Number.isInteger(e.month) &&
    Number.isInteger(e.day) &&
    (e.month as number) >= 1 &&
    (e.month as number) <= 12 &&
    (e.day as number) >= 1 &&
    (e.day as number) <= 31
  );
}

/** A month/day anchor `Date` for recurrence math (reference year, not stored). */
export function eventAnchorDate(e: DateParts): Date {
  return new Date(REF_YEAR, e.month - 1, e.day);
}

/** The next upcoming occurrence of the event. */
export function nextOccurrence(e: OccurrenceParts): Date {
  return getNextEventOccurrence(eventAnchorDate(e), e.recurrence, e.recurrence_rule);
}

/**
 * Age / anniversary label for a given occurrence, or `null` when no origin year
 * is known (or the year is in the future). Birthdays read as "Turning N"; every
 * other tag (anniversary and custom) reads as "N years".
 */
export function eventAgeLabel(
  e: Pick<Event, 'year' | 'tag'>,
  occurrenceYear: number,
): string | null {
  if (!e.year) return null;
  const n = occurrenceYear - e.year;
  if (n < 0) return null;
  return e.tag === 'birthday' ? `Turning ${n}` : `${n} years`;
}
