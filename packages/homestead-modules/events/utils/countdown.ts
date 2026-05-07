/**
 * Pure helpers for the events-module countdown widget.
 *
 * The widget shows a row of unit cells (months/weeks/days/hours/minutes/
 * seconds) for the time remaining until a configured event. Which cells
 * appear is configurable; this module knows how to split a remaining-ms
 * value across the enabled cells, in canonical (largest-first) order.
 */

export const COUNTDOWN_UNITS = [
  'months',
  'weeks',
  'days',
  'hours',
  'minutes',
  'seconds',
] as const;

export type CountdownUnit = (typeof COUNTDOWN_UNITS)[number];

// "Months" is treated as 30 days. The widget is a glanceable countdown,
// not an accounting tool — exact calendar months would make the seconds
// cell jitter as days fall in/out of a month.
const MS_PER_UNIT: Record<CountdownUnit, number> = {
  months: 30 * 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  hours: 60 * 60 * 1000,
  minutes: 60 * 1000,
  seconds: 1000,
};

export interface CountdownCell {
  unit: CountdownUnit;
  value: number;
}

/**
 * Walk `units` in canonical (largest-first) order, peel whole values off
 * `ms`, and pass the remainder down. Negative `ms` clamps to zero so the
 * widget never shows negative cells when the target has passed.
 */
export function decomposeRemaining(
  ms: number,
  units: ReadonlyArray<CountdownUnit>,
): CountdownCell[] {
  const ordered = COUNTDOWN_UNITS.filter((u) => units.includes(u));
  let remaining = Math.max(0, ms);
  return ordered.map((unit) => {
    const size = MS_PER_UNIT[unit];
    const value = Math.floor(remaining / size);
    remaining -= value * size;
    return { unit, value };
  });
}

/**
 * Pick a setInterval period matching the finest enabled unit. Coarser
 * configurations tick less often so we don't repaint the widget every
 * second when only days/hours are showing.
 */
export function tickIntervalMs(units: ReadonlyArray<CountdownUnit>): number {
  if (units.includes('seconds')) return 1000;
  if (units.includes('minutes')) return 60 * 1000;
  return 60 * 60 * 1000;
}
