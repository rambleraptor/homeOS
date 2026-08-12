/**
 * Turning stored `garbage-pickup` rows into what the UI actually shows: the
 * next few collection *days*, each carrying the streams that go out that day.
 *
 * Dates are handled as plain `YYYY-MM-DD` strings on purpose. `new Date('2026-08-17')`
 * parses as UTC midnight, which reads back as the 16th anywhere west of
 * Greenwich — the exact class of off-by-one the events app split month/day to
 * avoid. So "is this today or later?" is a lexical string compare, and a real
 * `Date` is built only when we need calendar arithmetic, via {@link parseIsoDate}.
 */

import type { GarbagePickup, GarbageStream } from '../types';

/** Display order for streams sharing a collection day: trash, then the rest. */
const STREAM_ORDER: readonly string[] = [
  'garbage',
  'recyclable',
  'organic',
  'yard-waste',
  'bulk',
  'hazardous',
];

const STREAM_LABELS: Record<GarbageStream, string> = {
  garbage: 'Trash',
  recyclable: 'Recycling',
  'yard-waste': 'Yard waste',
  organic: 'Compost',
  bulk: 'Bulk item',
  hazardous: 'Hazardous waste',
};

/**
 * Human label for a stream. The wire value is an unconstrained string (aepbase
 * strips enums), so an unrecognized stream degrades to a de-kebabed version of
 * itself rather than rendering blank.
 */
export function streamLabel(stream: string): string {
  return (
    STREAM_LABELS[stream as GarbageStream] ??
    stream.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())
  );
}

/** Local-midnight `Date` for a `YYYY-MM-DD` string. Returns null if unparseable. */
export function parseIsoDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  // Rejects overflow like 2026-02-30, which the Date constructor would
  // silently roll forward into March.
  return date.getMonth() === Number(month) - 1 ? date : null;
}

/** Today as `YYYY-MM-DD` in the viewer's timezone. */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Whole days from `from` to `to`, both taken as calendar dates. */
export function daysBetween(from: string, to: string): number | null {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/**
 * "Today" / "Tomorrow" / "Thursday" within the week, and a dated form beyond
 * it. Returns null when `iso` isn't a parseable date.
 */
export function relativeDayLabel(iso: string, now: Date = new Date()): string | null {
  const date = parseIsoDate(iso);
  const delta = daysBetween(todayIso(now), iso);
  if (!date || delta === null) return null;
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Tomorrow';
  if (delta > 1 && delta < 7) {
    return date.toLocaleDateString(undefined, { weekday: 'long' });
  }
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** One collection day and everything going to the curb on it. */
export interface PickupDay {
  /** ISO `YYYY-MM-DD`. Doubles as a stable React key — it's unique per group. */
  date: string;
  /** Whole days from today; 0 is today. */
  daysAway: number;
  pickups: GarbagePickup[];
  /** True when any stream that day was pushed by a holiday. */
  delayed: boolean;
}

export interface UpcomingPickupOptions {
  /** How far ahead to look, in days. Defaults to 14. */
  days?: number;
  /** Injectable clock, for tests. */
  now?: Date;
}

/**
 * Group pickups from today forward into collection days, soonest first.
 *
 * Rows with an unparseable or past `pickup_date` are dropped rather than
 * surfaced — a stale row from a sync that fell over shouldn't read as an
 * upcoming pickup.
 */
export function upcomingPickupDays(
  pickups: readonly GarbagePickup[],
  { days = 14, now = new Date() }: UpcomingPickupOptions = {},
): PickupDay[] {
  const today = todayIso(now);
  const byDate = new Map<string, GarbagePickup[]>();

  for (const pickup of pickups) {
    const delta = daysBetween(today, pickup.pickup_date ?? '');
    if (delta === null || delta < 0 || delta > days) continue;
    const group = byDate.get(pickup.pickup_date);
    if (group) group.push(pickup);
    else byDate.set(pickup.pickup_date, [pickup]);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, group]) => ({
      date,
      daysAway: daysBetween(today, date) ?? 0,
      pickups: group.sort(
        (a, b) => streamRank(a.stream) - streamRank(b.stream),
      ),
      delayed: group.some((pickup) => pickup.status === 'delayed'),
    }));
}

/** Unknown streams sort last, in wire order among themselves. */
function streamRank(stream: string): number {
  const index = STREAM_ORDER.indexOf(stream);
  return index === -1 ? STREAM_ORDER.length : index;
}
