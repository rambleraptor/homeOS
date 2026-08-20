/**
 * Date helpers for standalone reminders.
 *
 * A reminder stores one absolute instant (`due_at`, RFC3339), but the form
 * splits it into a required date and an *optional* time — "remind me Thursday"
 * is the common case, and forcing a time on it is friction for no gain. When no
 * time is given the reminder lands at {@link DEFAULT_HOUR}, matching the hour
 * the events reminder cron already fires at, so a day-granularity reminder
 * behaves the same way an event reminder does.
 *
 * Everything here works in the browser's local timezone: the user picks a wall
 * clock time and that is the instant stored. `new Date(y, m, d, h)` is the local
 * constructor, so no offset arithmetic is needed.
 */

/** Hour a date-only reminder is due at, local time. Mirrors `events-notify`. */
export const DEFAULT_HOUR = 9;

/** Two-digit zero-padded, for `YYYY-MM-DD` / `HH:MM` assembly. */
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Combine a `YYYY-MM-DD` date and an optional `HH:MM` time into an RFC3339
 * instant. Returns null when the date is missing or unparseable, so a caller
 * can treat "no usable due date" as one case.
 */
export function toDueAt(date: string, time?: string): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!dateMatch) return null;
  const [, y, m, d] = dateMatch;

  const timeMatch = time ? /^(\d{2}):(\d{2})$/.exec(time.trim()) : null;
  const hour = timeMatch ? Number(timeMatch[1]) : DEFAULT_HOUR;
  const minute = timeMatch ? Number(timeMatch[2]) : 0;
  if (hour > 23 || minute > 59) return null;

  const due = new Date(Number(y), Number(m) - 1, Number(d), hour, minute, 0, 0);
  if (Number.isNaN(due.getTime())) return null;
  // Guard against a rolled-over date (e.g. February 31 → March 3): the native
  // constructor normalises silently, which would store a day the user never
  // picked.
  if (due.getMonth() !== Number(m) - 1 || due.getDate() !== Number(d)) return null;
  return due.toISOString();
}

/**
 * Split a stored `due_at` back into the form's date and time controls. The time
 * is returned even when it equals {@link DEFAULT_HOUR} — once a reminder exists,
 * showing its real time is less surprising than showing a blank box that would
 * silently re-derive the same value.
 */
export function fromDueAt(dueAt: string | undefined): { date: string; time: string } {
  if (!dueAt) return { date: '', time: '' };
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return { date: '', time: '' };
  return {
    date: `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`,
    time: `${pad(due.getHours())}:${pad(due.getMinutes())}`,
  };
}

/** True when the reminder's due instant has already passed. */
export function isOverdue(dueAt: string, now: Date = new Date()): boolean {
  const due = new Date(dueAt);
  return !Number.isNaN(due.getTime()) && due.getTime() < now.getTime();
}

/**
 * Human label for a due instant: "Today, 9:00 AM", "Tomorrow, 2:30 PM", or a
 * full date. Relative wording only for the two days that read naturally that
 * way — "in 4 days" is harder to act on than the date itself.
 */
export function formatDueAt(dueAt: string, now: Date = new Date()): string {
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return '';

  const time = due.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayDelta = Math.round(
    (new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() -
      startOfToday.getTime()) /
      86_400_000,
  );

  if (dayDelta === 0) return `Today, ${time}`;
  if (dayDelta === 1) return `Tomorrow, ${time}`;
  if (dayDelta === -1) return `Yesterday, ${time}`;

  const sameYear = due.getFullYear() === now.getFullYear();
  const date = due.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  return `${date}, ${time}`;
}
