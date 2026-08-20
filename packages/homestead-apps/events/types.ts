/**
 * Events app types.
 *
 * The `tag` field is free-form on the wire (aepbase strips JSON-schema
 * enums on round-trip). The form constrains values UI-side via
 * `KNOWN_EVENT_TAGS`.
 */

export type KnownEventTag = 'birthday' | 'anniversary';

export const KNOWN_EVENT_TAGS: readonly KnownEventTag[] = [
  'birthday',
  'anniversary',
] as const;

export type EventRecurrence = 'yearly' | 'yearly-nth-weekday';

export interface Event {
  id: string;
  name: string;
  /** Month of the event, 1-12. Honored for both recurrence modes. */
  month: number;
  /**
   * Day of the month, 1-31. Honored for fixed-date yearly events; ignored for
   * `yearly-nth-weekday` (where `recurrence_rule` controls the weekday and
   * occurrence and only `month` matters).
   */
  day: number;
  /**
   * Optional origin year — birth year for a birthday, wedding year for an
   * anniversary. When present, drives the displayed age / anniversary count;
   * never affects the recurrence.
   */
  year?: number;
  /** @deprecated Legacy single date-time field; superseded by month/day/year. */
  date?: string;
  tag?: string;
  /** Array of `people/{person_id}` reference strings. */
  people?: string[];
  recurrence?: EventRecurrence;
  /**
   * For `yearly-nth-weekday`: `<n>:<weekday>` where n is 1..4 or -1 (last)
   * and weekday is 0=Sun..6=Sat. Example: `"2:0"` = 2nd Sunday.
   */
  recurrence_rule?: string;
  created_by?: string;
  create_time?: string;
  update_time?: string;
}

export interface EventFormData {
  name: string;
  month: number;
  day: number;
  /** Optional origin year; `null` clears a previously-set year on update. */
  year?: number | null;
  tag?: string;
  /** Bare person ids — `people/` prefix is added on submit. */
  people: string[];
  recurrence?: EventRecurrence;
  recurrence_rule?: string;
}

/**
 * Stored reminder lead times. `none` is not a stored value — it's the absence
 * of an `event-reminder` record — but the UI models it as a fourth option so a
 * single control can turn a reminder off (delete the record) or on.
 */
export type ReminderLead = 'day_of' | 'week_before' | 'both';
export type ReminderChoice = 'none' | ReminderLead;

/** A user's reminder preference for one event (`/users/{id}/event-reminders`). */
export interface EventReminder {
  id: string;
  /** Bare event id (no `events/` prefix). */
  event_id: string;
  lead: ReminderLead;
  create_time?: string;
  update_time?: string;
}

/**
 * A standalone reminder (`/reminders`). Distinct from {@link EventReminder},
 * which is a per-user notification preference for an event — this is a thing to
 * be reminded about in its own right.
 */
export type ReminderStatus = 'pending' | 'done';

/**
 * Who a reminder is for. Fixed at create (the field is `immutable`) — changing
 * it means deleting the reminder and making a new one.
 */
export type ReminderVisibility = 'private' | 'household';

export interface Reminder {
  id: string;
  title: string;
  notes?: string;
  /** RFC3339 instant the reminder is due. */
  due_at: string;
  status?: ReminderStatus;
  visibility?: ReminderVisibility;
  /**
   * Id of the app that raised this reminder (`events`, `home`, …). Unset on one
   * a person created — which is the distinction the reminders tab filters on.
   */
  type?: string;
  /** The creating app's idempotency key. Opaque outside that app. */
  source_key?: string;
  /**
   * Bare user ids to notify. Empty/absent means everyone who can see the
   * reminder.
   */
  notify_users?: string[];
  created_by?: string;
  create_time?: string;
  update_time?: string;
}

export interface ReminderFormData {
  title: string;
  /** `null` clears previously-entered notes on update. */
  notes?: string | null;
  due_at: string;
  status?: ReminderStatus;
  /** Create-only. Omitted on update — the engine rejects it with a 400. */
  visibility?: ReminderVisibility;
  /** Create-only. Bare user id of whoever is adding the reminder. */
  created_by?: string;
}

/** True for a reminder an app raised rather than a person. */
export function isAppReminder(reminder: Reminder): boolean {
  return typeof reminder.type === 'string' && reminder.type !== '';
}
