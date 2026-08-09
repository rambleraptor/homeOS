/**
 * `events-notify` cron handler.
 *
 * Once a day at 09:00 server-local (see the `crons` entry in `../app.config.ts`)
 * this scans every household event, works out which are due **today** or **in
 * exactly one week**, and notifies each user according to the per-event,
 * per-user reminder they set (`event-reminder` records under their user).
 *
 * Recipients are decoupled from the (household-wide) event: user A can want a
 * week's warning for an event that user B ignores entirely. The handler holds a
 * short-lived admin token, so it reads every user's reminders and pushes to
 * each via {@link sendNotificationToUser}.
 *
 * Idempotency: every send writes an inbox `notification` stamped with the
 * event id (`source_id`), the lead (`notification_type`), and the occurrence
 * date (`scheduled_for`). Before sending, the handler loads each user's prior
 * event notifications and skips any (event, lead, occurrence) already recorded —
 * so re-running the cron, or a `runOnStart` catch-up, never double-sends, and
 * next year's occurrence (a different date) is not confused with this year's.
 *
 * Server-only: lives under `crons/`, so vite stubs it out of the browser
 * bundle.
 */

import type { CronHandler } from '@rambleraptor/homestead-core/apps/types';
import { serverClient } from '@rambleraptor/homestead-core/server/client';
import {
  sendNotificationToUser,
  type NotificationType,
} from '@rambleraptor/homestead-core/server/notifications';
import { NOTIFICATIONS } from '@rambleraptor/homestead-core/notifications/constants';
import { EVENTS, EVENT_REMINDERS } from '../resources';
import { eventAgeLabel, hasEventDate, nextOccurrence } from '../utils/eventDate';
import type { Event, EventReminder, ReminderLead } from '../types';

interface NotificationRow {
  source_id?: string;
  notification_type?: string;
  scheduled_for?: string;
}

interface DueEvent {
  event: Event;
  occurrence: Date;
}

/** Which inbox notification types a stored lead should produce. */
const LEAD_TO_TYPES: Record<ReminderLead, NotificationType[]> = {
  day_of: ['day_of'],
  week_before: ['week_before'],
  both: ['day_of', 'week_before'],
};

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Local-midnight date `n` days after `from`'s calendar day. */
function localDayPlus(from: Date, n: number): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + n);
}

/** Stable per-(event, lead, occurrence) key used for dedup. */
function dedupKey(
  sourceId: string | undefined,
  type: string | undefined,
  scheduledFor: string | undefined,
): string {
  return `${sourceId ?? ''}|${type ?? ''}|${scheduledFor ?? ''}`;
}

function buildContent(
  event: Event,
  type: NotificationType,
  occurrence: Date,
): { title: string; body: string } {
  const label = event.name;
  const dateStr = occurrence.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });
  const age = eventAgeLabel(event, occurrence.getFullYear());
  const ageSuffix = age ? ` ${age}.` : '';
  if (type === 'day_of') {
    return {
      title: `Today: ${label}`,
      body: `${label} is today (${dateStr}).${ageSuffix}`,
    };
  }
  return {
    title: `Next week: ${label}`,
    body: `${label} is one week away — ${dateStr}.${ageSuffix}`,
  };
}

const handler: CronHandler = async ({ token, firedAt, log }) => {
  const hs = serverClient(token);
  const now = new Date(firedAt);
  const inAWeek = localDayPlus(now, 7);

  const events = await hs.collection<Event>(EVENTS).listAll();

  // An event's single next occurrence lands it in at most one bucket: it's
  // either today (day_of) or a week out (week_before), never both.
  const dueDayOf = new Map<string, DueEvent>();
  const dueWeekBefore = new Map<string, DueEvent>();
  for (const event of events) {
    if (!hasEventDate(event)) continue;
    const occurrence = nextOccurrence(event);
    if (isSameLocalDay(occurrence, now)) {
      dueDayOf.set(event.id, { event, occurrence });
    } else if (isSameLocalDay(occurrence, inAWeek)) {
      dueWeekBefore.set(event.id, { event, occurrence });
    }
  }

  if (dueDayOf.size === 0 && dueWeekBefore.size === 0) {
    await log(`no events due (scanned ${events.length})`);
    return { events: events.length, dueDayOf: 0, dueWeekBefore: 0, sent: 0 };
  }

  const users = await hs.collection<{ id: string }>('users').listAll();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    const userRecord = hs.collection('users').record(user.id);
    const reminders = await userRecord
      .collection<EventReminder>(EVENT_REMINDERS)
      .listAll();
    if (reminders.length === 0) continue;

    // Prior event notifications for this user, as a dedup set.
    const prior = await userRecord
      .collection<NotificationRow>(NOTIFICATIONS)
      .listAll({ filter: `source_collection == 'events'` });
    const alreadySent = new Set(
      prior.map((n) => dedupKey(n.source_id, n.notification_type, n.scheduled_for)),
    );

    for (const reminder of reminders) {
      for (const type of LEAD_TO_TYPES[reminder.lead] ?? []) {
        const due =
          type === 'day_of'
            ? dueDayOf.get(reminder.event_id)
            : dueWeekBefore.get(reminder.event_id);
        if (!due) continue;

        const scheduledFor = due.occurrence.toISOString();
        const key = dedupKey(reminder.event_id, type, scheduledFor);
        if (alreadySent.has(key)) {
          skipped++;
          continue;
        }

        const { title, body } = buildContent(due.event, type, due.occurrence);
        const res = await sendNotificationToUser(token, user.id, {
          title,
          body,
          tag: `event-${reminder.event_id}-${type}`,
          url: '/events',
          sourceCollection: EVENTS,
          sourceId: reminder.event_id,
          notificationType: type,
          scheduledFor,
        });

        if (!res.ok) {
          failed++;
          continue;
        }
        // The send wrote the inbox row that is this key's durable record.
        alreadySent.add(key);
        sent++;
      }
    }
  }

  await log(
    `events=${events.length} dueDayOf=${dueDayOf.size} dueWeekBefore=${dueWeekBefore.size} sent=${sent} skipped=${skipped} failed=${failed}`,
  );
  return {
    events: events.length,
    dueDayOf: dueDayOf.size,
    dueWeekBefore: dueWeekBefore.size,
    sent,
    skipped,
    failed,
  };
};

export default handler;
