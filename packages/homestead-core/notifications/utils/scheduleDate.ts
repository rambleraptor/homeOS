/**
 * Date helpers for the Scheduled tab.
 *
 * A scheduled notification stores one absolute instant (`send_at`, RFC3339
 * UTC), but the form splits it into a required date and an *optional* time —
 * "remind me Thursday" is the common case and forcing a clock time on it is
 * friction for no gain. With no time given it lands at {@link DEFAULT_HOUR}.
 *
 * Everything here works in the browser's local timezone: the user picks a wall
 * clock time, `new Date(y, m, d, h)` interprets it locally, and `toISOString()`
 * normalizes it to UTC on the way out. The normalization matters — the
 * dispatcher selects due rows with a string comparison, which is only a time
 * comparison for UTC (see `server/scheduled-notifications.ts`).
 */

/**
 * Hour a date-only entry is delivered at, local time. Morning, because a
 * notification you didn't give a time to is one you want at the start of the
 * day rather than the end of it.
 */
export const DEFAULT_HOUR = 9;

/** Two-digit zero-padded, for `YYYY-MM-DD` / `HH:MM` assembly. */
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Combine a `YYYY-MM-DD` date and an optional `HH:MM` time into a UTC instant.
 * Returns null when the date is missing or unparseable, so a caller can treat
 * "no usable send time" as one case.
 */
export function toSendAt(date: string, time?: string): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!dateMatch) return null;
  const [, y, m, d] = dateMatch;

  const timeMatch = time ? /^(\d{2}):(\d{2})$/.exec(time.trim()) : null;
  const hour = timeMatch ? Number(timeMatch[1]) : DEFAULT_HOUR;
  const minute = timeMatch ? Number(timeMatch[2]) : 0;
  if (hour > 23 || minute > 59) return null;

  const at = new Date(Number(y), Number(m) - 1, Number(d), hour, minute, 0, 0);
  if (Number.isNaN(at.getTime())) return null;
  // Guard against a rolled-over date (February 31 → March 3): the native
  // constructor normalises silently, which would store a day nobody picked.
  if (at.getMonth() !== Number(m) - 1 || at.getDate() !== Number(d)) return null;
  return at.toISOString();
}

/**
 * Split a stored `send_at` back into the form's date and time controls. The
 * time comes back even when it equals {@link DEFAULT_HOUR} — once the row
 * exists, showing its real time is less surprising than a blank box that would
 * silently re-derive the same value.
 */
export function fromSendAt(sendAt: string | undefined): { date: string; time: string } {
  if (!sendAt) return { date: '', time: '' };
  const at = new Date(sendAt);
  if (Number.isNaN(at.getTime())) return { date: '', time: '' };
  return {
    date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
  };
}

/** Just the clock time, e.g. "6:00 PM". The day is carried by the group header. */
export function formatTime(sendAt: string): string {
  const at = new Date(sendAt);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Whole days from `now`'s calendar day to `sendAt`'s. Negative for the past. */
export function dayDelta(sendAt: string, now: Date = new Date()): number | null {
  const at = new Date(sendAt);
  if (Number.isNaN(at.getTime())) return null;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  return Math.round((startOfDay.getTime() - startOfToday.getTime()) / 86_400_000);
}

/**
 * Header for a day group: "Today", "Tomorrow", "Thursday" inside the coming
 * week, then a plain date. Relative wording only where it reads naturally —
 * "in 9 days" is harder to act on than "Sep 3".
 */
export function dayLabel(sendAt: string, now: Date = new Date()): string {
  const at = new Date(sendAt);
  const delta = dayDelta(sendAt, now);
  if (delta === null) return '';
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Tomorrow';
  if (delta === -1) return 'Yesterday';
  if (delta > 1 && delta < 7) return at.toLocaleDateString('en-US', { weekday: 'long' });

  const sameYear = at.getFullYear() === now.getFullYear();
  return at.toLocaleDateString('en-US', {
    weekday: delta > 0 && delta < 14 ? 'long' : undefined,
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** `YYYY-MM-DD` in local time — the key rows are grouped by. */
export function dayKey(sendAt: string): string {
  const at = new Date(sendAt);
  if (Number.isNaN(at.getTime())) return '';
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** True when the moment has passed but the row hasn't been delivered yet. */
export function isOverdue(sendAt: string, now: Date = new Date()): boolean {
  const at = new Date(sendAt);
  return !Number.isNaN(at.getTime()) && at.getTime() < now.getTime();
}
