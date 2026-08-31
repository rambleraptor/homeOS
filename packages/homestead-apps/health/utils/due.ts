import type { DueStatus, Vaccination } from '../types';

/** A `next_due` within this many days of today counts as "due soon". */
export const DUE_SOON_DAYS = 60;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parse an ISO YYYY-MM-DD as a UTC day, so comparisons ignore time of day. */
function parseIsoDay(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * Whole days from `todayIso` until `dueIso` (negative when past). Null for
 * an unparseable date.
 */
export function daysUntil(dueIso: string, todayIso: string): number | null {
  const due = parseIsoDay(dueIso);
  const today = parseIsoDay(todayIso);
  if (due === null || today === null) return null;
  return Math.round((due - today) / MS_PER_DAY);
}

/**
 * Classify a vaccination's `next_due` relative to today: `overdue` (past),
 * `due-soon` (within {@link DUE_SOON_DAYS}), `ok` (further out), or `none`
 * when there is no parseable due date (series complete / unknown).
 */
export function dueStatus(
  nextDue: string | undefined,
  todayIso: string,
): DueStatus {
  if (!nextDue) return 'none';
  const days = daysUntil(nextDue, todayIso);
  if (days === null) return 'none';
  if (days < 0) return 'overdue';
  if (days <= DUE_SOON_DAYS) return 'due-soon';
  return 'ok';
}

/**
 * The records needing attention — overdue or due within the window — sorted
 * soonest-first so the most urgent lead. Powers the "due soon" strip on the
 * Health home.
 */
export function dueSoon(
  vaccinations: readonly Vaccination[],
  todayIso: string,
): Vaccination[] {
  return vaccinations
    .filter((v) => {
      const status = dueStatus(v.next_due, todayIso);
      return status === 'overdue' || status === 'due-soon';
    })
    .sort((a, b) => (a.next_due ?? '').localeCompare(b.next_due ?? ''));
}

/** Today as ISO YYYY-MM-DD in the local timezone. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
