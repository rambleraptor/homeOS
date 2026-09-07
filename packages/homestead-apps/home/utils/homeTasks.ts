/**
 * Turning a `home-task` schedule into the things the UI and the reminder cron
 * both need: when it next comes round, how overdue it is, and how to say the
 * cadence out loud.
 *
 * Dates are plain `YYYY-MM-DD` strings throughout, for the reason spelled out
 * in `./pickups`: `new Date('2026-08-17')` parses as UTC midnight and reads
 * back as the 16th west of Greenwich. Calendar arithmetic goes through
 * `parseIsoDate` / `toIsoDate`, and "is this due yet?" is a lexical compare.
 */

import { daysBetween, parseIsoDate, todayIso } from './pickups';
import type { HomeTask, HomeTaskIntervalUnit } from '../types';

export { todayIso };

/** ISO `YYYY-MM-DD` for a local `Date`. */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const UNIT_LABELS: Record<HomeTaskIntervalUnit, string> = {
  day: 'day',
  week: 'week',
  month: 'month',
  year: 'year',
};

/**
 * Advance an ISO date by `count` × `unit`, as a person would count it: "3
 * months from January 31st" is April 30th, not May 1st, so a month/year step
 * that overflows the target month is clamped to its last day. Returns null when
 * `iso` isn't a parseable date or the interval isn't a positive whole number.
 */
export function addInterval(
  iso: string,
  count: number,
  unit: HomeTaskIntervalUnit,
): string | null {
  const start = parseIsoDate(iso);
  if (!start || !Number.isInteger(count) || count < 1) return null;

  if (unit === 'day' || unit === 'week') {
    const days = unit === 'week' ? count * 7 : count;
    return toIsoDate(
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + days),
    );
  }

  const months = unit === 'year' ? count * 12 : count;
  const target = new Date(start.getFullYear(), start.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return toIsoDate(
    new Date(target.getFullYear(), target.getMonth(), Math.min(start.getDate(), lastDay)),
  );
}

/**
 * The `next_due` a task should carry after being marked done on `completedOn`.
 *
 * Counted from the completion, not from the date it *was* due: a filter changed
 * three weeks late still lasts its full three months from the day it went in.
 * Falls back to the stored `next_due` if the interval can't be applied, so a
 * malformed row never loses its schedule.
 */
export function nextDueAfterCompletion(task: HomeTask, completedOn: string): string {
  return (
    addInterval(completedOn, task.interval_count, task.interval_unit) ?? task.next_due
  );
}

/** "Monthly", "Every 3 months", "Every 2 weeks", "Yearly". */
export function intervalLabel(count: number, unit: HomeTaskIntervalUnit): string {
  const noun = UNIT_LABELS[unit] ?? unit;
  if (count === 1) {
    return { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' }[unit] ?? `Every ${noun}`;
  }
  return `Every ${count} ${noun}s`;
}

/** Where a task sits relative to today. Drives the badge and the sort. */
export type HomeTaskUrgency = 'overdue' | 'due-today' | 'due-soon' | 'scheduled' | 'paused';

/** Anything due within this many days reads as "due soon". */
export const DUE_SOON_DAYS = 14;

export function urgencyOf(task: HomeTask, today: string = todayIso()): HomeTaskUrgency {
  if (task.paused) return 'paused';
  const delta = daysBetween(today, task.next_due ?? '');
  if (delta === null) return 'scheduled';
  if (delta < 0) return 'overdue';
  if (delta === 0) return 'due-today';
  return delta <= DUE_SOON_DAYS ? 'due-soon' : 'scheduled';
}

/** "3 days overdue" / "Due today" / "Due in 5 days" / "Due Mar 4". */
export function dueLabel(task: HomeTask, today: string = todayIso()): string {
  const delta = daysBetween(today, task.next_due ?? '');
  const date = parseIsoDate(task.next_due ?? '');
  if (delta === null || !date) return 'No due date';
  if (delta < 0) {
    const late = Math.abs(delta);
    return `${late} day${late === 1 ? '' : 's'} overdue`;
  }
  if (delta === 0) return 'Due today';
  if (delta === 1) return 'Due tomorrow';
  if (delta <= DUE_SOON_DAYS) return `Due in ${delta} days`;
  return `Due ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/**
 * Soonest first, with paused tasks parked at the end — a schedule nobody is
 * being reminded about shouldn't sit above the gutters that needed doing last
 * week. Ties break on name so the order is stable between renders.
 */
export function byDueDate(a: HomeTask, b: HomeTask): number {
  if (Boolean(a.paused) !== Boolean(b.paused)) return a.paused ? 1 : -1;
  const due = (a.next_due ?? '').localeCompare(b.next_due ?? '');
  return due !== 0 ? due : (a.name ?? '').localeCompare(b.name ?? '');
}
