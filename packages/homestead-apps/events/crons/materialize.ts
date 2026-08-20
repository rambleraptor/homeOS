/**
 * `events-materialize-reminders` cron handler.
 *
 * Events used to push their own notifications: a daily 09:00 job scanned every
 * event, matched it against each user's `event-reminder` preference, and called
 * the push helper directly. That made "events" a second, parallel notification
 * pipeline next to reminders, with its own dedup rules and its own idea of what
 * time of day to interrupt someone.
 *
 * It no longer sends anything. Once a day it **materializes** the event
 * reminders that are coming up into ordinary `reminder` records — stamped
 * `type: 'events'` so the reminders tab keeps them out of the way — and the two
 * reminder crons deliver them like any other reminder. One pipeline, one
 * schedule, one inbox convention.
 *
 * **Reconciliation, not fire-and-forget.** Each run recomputes the reminders the
 * current events and preferences imply for the next {@link HORIZON_DAYS} days,
 * keyed by `source_key` (`<event id>:<lead>:<occurrence year>`), and makes the
 * stored rows match: create what's missing, patch what drifted (an event
 * renamed, someone opting in or out), delete a future row nothing implies any
 * more. Rows whose moment has passed are left alone — they're the record of what
 * was announced — until {@link PRUNE_AFTER_DAYS} sweeps them.
 *
 * **Recipients.** An event reminder is per-user (one household member wants a
 * week's warning, another wants nothing), but a reminder row created by a cron
 * cannot be *owned* by a user — the engine stamps the caller as owner, and the
 * caller here is the scheduler. So the row stays household-visible and carries
 * `notify_users`: the people who actually opted in. See `notifyReminders.ts`.
 *
 * Server-only: lives under `crons/`, so vite stubs it out of the browser bundle.
 */

import type { CronHandler } from '@rambleraptor/homestead-core/apps/types';
import { serverClient } from '@rambleraptor/homestead-core/server/client';
import { EVENTS, EVENT_REMINDERS } from '../resources';
import { eventAgeLabel, hasEventDate, nextOccurrence } from '../utils/eventDate';
import { MORNING_HOUR } from '../utils/reminderDate';
import { bareId } from '../utils/referenceId';
import { reconcileReminders, type PlannedReminder } from './materializer';
import type { Event, EventReminder, ReminderLead } from '../types';

/** The app id stamped on every reminder this handler raises. */
export const EVENTS_REMINDER_TYPE = 'events';

/**
 * How far ahead to materialize. A week-before reminder is due 7 days before its
 * event, so 9 gives the daily run two days of slack — enough that a server down
 * over a weekend still writes the row before its moment.
 */
export const HORIZON_DAYS = 9;

/** How far back a delivered event reminder is kept before being swept. */
export const PRUNE_AFTER_DAYS = 30;

/** How long before the event each lead fires. */
const LEAD_OFFSET_DAYS: Record<Exclude<ReminderLead, 'both'>, number> = {
  day_of: 0,
  week_before: 7,
};

/** Which concrete leads a stored preference expands to. */
const LEAD_EXPANSION: Record<ReminderLead, Array<'day_of' | 'week_before'>> = {
  day_of: ['day_of'],
  week_before: ['week_before'],
  both: ['day_of', 'week_before'],
};

/** Local-midnight date `n` days before `from`'s calendar day. */
function localDayMinus(from: Date, n: number): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() - n);
}

/**
 * Copy for one materialized reminder. Deliberately the same wording the old
 * direct-send cron used, so an inbox spanning the change reads consistently.
 */
export function buildContent(
  event: Event,
  lead: 'day_of' | 'week_before',
  occurrence: Date,
): { title: string; notes: string } {
  const dateStr = occurrence.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });
  const age = eventAgeLabel(event, occurrence.getFullYear());
  const ageSuffix = age ? ` ${age}.` : '';
  return lead === 'day_of'
    ? {
        title: `Today: ${event.name}`,
        notes: `${event.name} is today (${dateStr}).${ageSuffix}`,
      }
    : {
        title: `Next week: ${event.name}`,
        notes: `${event.name} is one week away — ${dateStr}.${ageSuffix}`,
      };
}

const handler: CronHandler = async ({ token, firedAt, log }) => {
  const hs = serverClient(token);
  const now = new Date(firedAt);
  const horizonEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + HORIZON_DAYS,
    23,
    59,
    59,
    999,
  ).getTime();
  // A firing that lands after a reminder's moment still writes the row: the
  // notify cron's own lookback decides whether it's too late to say anything.
  const horizonStart = new Date(now.getTime() - 86_400_000).getTime();

  const events = await hs.collection<Event>(EVENTS).listAll();
  const users = await hs.collection<{ id: string }>('users').listAll();

  // (event id, lead) → the users who asked for it.
  const optIns = new Map<string, Set<string>>();
  for (const user of users) {
    const prefs = await hs
      .collection('users')
      .record(user.id)
      .collection<EventReminder>(EVENT_REMINDERS)
      .listAll();
    for (const pref of prefs) {
      const eventId = bareId(pref.event_id);
      for (const lead of LEAD_EXPANSION[pref.lead] ?? []) {
        const key = `${eventId}:${lead}`;
        const set = optIns.get(key);
        if (set) set.add(user.id);
        else optIns.set(key, new Set([user.id]));
      }
    }
  }

  const planned = new Map<string, PlannedReminder>();
  for (const event of events) {
    if (!hasEventDate(event)) continue;
    const occurrence = nextOccurrence(event);
    for (const lead of ['day_of', 'week_before'] as const) {
      const recipients = optIns.get(`${event.id}:${lead}`);
      if (!recipients || recipients.size === 0) continue;

      const day = localDayMinus(occurrence, LEAD_OFFSET_DAYS[lead]);
      const dueAt = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        MORNING_HOUR,
        0,
        0,
        0,
      );
      const at = dueAt.getTime();
      if (at < horizonStart || at > horizonEnd) continue;

      const { title, notes } = buildContent(event, lead, occurrence);
      const sourceKey = `${event.id}:${lead}:${occurrence.getFullYear()}`;
      planned.set(sourceKey, {
        source_key: sourceKey,
        title,
        notes,
        due_at: dueAt.toISOString(),
        notify_users: [...recipients],
      });
    }
  }

  const outcome = await reconcileReminders(token, EVENTS_REMINDER_TYPE, planned, {
    now,
    pruneAfterDays: PRUNE_AFTER_DAYS,
  });

  await log(
    `events=${events.length} planned=${planned.size} created=${outcome.created} updated=${outcome.updated} unchanged=${outcome.unchanged} withdrawn=${outcome.withdrawn} pruned=${outcome.pruned}`,
  );
  return { events: events.length, planned: planned.size, ...outcome };
};

export default handler;
