/**
 * The reminder delivery cron — shared by the morning and evening firings.
 *
 * Reminders are the household's one notification surface for anything with a
 * due time. A person adds one by hand; an app materializes one from a record it
 * owns (see `crons/materialize.ts` for event reminders, and the Home app's
 * pickup reminders). Neither of them sends anything — this handler does, twice a
 * day, so there is exactly one place that decides who hears about a due
 * reminder and exactly two moments a day when Homestead interrupts anyone.
 *
 * **The window.** Each firing delivers every pending reminder due at or before
 * the *next* firing: the 09:00 run covers up to 18:00 today, the 18:00 run
 * covers up to 09:00 tomorrow. So a reminder is announced at the last slot
 * before it comes due — "bins out tonight" arrives in the evening, not at
 * breakfast — and no reminder falls between the two windows. Anything already
 * overdue is included (a reminder nobody was told about is worth telling about
 * late), but only back to {@link MAX_LOOKBACK_DAYS}: a reminder from last month
 * that was never delivered is history, not news.
 *
 * **Idempotency.** Every send writes an inbox `notification` stamped with the
 * reminder id (`source_id`) and its due instant (`scheduled_for`). Before
 * sending, the handler loads each recipient's prior reminder notifications and
 * skips any (reminder, due instant) pair already recorded — so overlapping
 * windows, a `runOnStart` catch-up, and a re-materialized app reminder never
 * double-send. Moving a reminder's `due_at` deliberately re-notifies: it's a
 * different instant, and the point of moving it was to be told at the new time.
 *
 * Server-only: lives under `crons/`, so vite stubs it out of the browser bundle.
 */

import type { CronContext, CronHandler } from '@rambleraptor/homestead-core/apps/types';
import { getAppById } from '@rambleraptor/homestead-core/apps/registry';
import { serverClient } from '@rambleraptor/homestead-core/server/client';
import { sendNotificationToUser } from '@rambleraptor/homestead-core/server/notifications';
import { NOTIFICATIONS } from '@rambleraptor/homestead-core/notifications/constants';
import { REMINDERS } from '../resources';
import { EVENING_HOUR, MORNING_HOUR, formatDueAt } from '../utils/reminderDate';
import { bareId } from '../utils/referenceId';
import type { Reminder } from '../types';

/** Which of the two daily firings a handler is. */
export type ReminderSlot = 'morning' | 'evening';

/**
 * How far back an undelivered reminder still earns a notification. Past this
 * the reminder stays on the list (it's still outstanding) but stops shouting.
 */
export const MAX_LOOKBACK_DAYS = 7;

interface NotificationRow {
  source_id?: string;
  scheduled_for?: string;
}

/**
 * The instant this firing's window closes: the next slot on the clock. Derived
 * from the firing's own slot rather than from "the next slot after now", so a
 * run that starts a minute early or hours late (a `runOnStart` catch-up) still
 * covers the window it was meant to.
 */
export function windowEnd(slot: ReminderSlot, firedAt: Date): Date {
  const y = firedAt.getFullYear();
  const m = firedAt.getMonth();
  const d = firedAt.getDate();
  return slot === 'morning'
    ? new Date(y, m, d, EVENING_HOUR, 0, 0, 0)
    : new Date(y, m, d + 1, MORNING_HOUR, 0, 0, 0);
}

/**
 * Who hears about this reminder.
 *
 * `notify_users` wins when it's set — that's an app narrowing delivery to the
 * people who opted in, on a row the whole household can still see. Otherwise
 * visibility decides: a private reminder reaches only its owner, a household one
 * reaches everybody. Ids that don't match a current user are dropped, so a
 * deleted account can't strand a send.
 */
export function recipientsFor(
  reminder: Reminder,
  userIds: readonly string[],
): string[] {
  const explicit = (reminder.notify_users ?? [])
    .map((id) => bareId(id))
    .filter((id) => userIds.includes(id));
  if (explicit.length > 0) return explicit;

  if (reminder.visibility === 'private') {
    const owner = bareId(reminder.created_by);
    // A private reminder with no `created_by` is unaddressable from here: the
    // engine's `_owner` column isn't exposed over the API. It stays visible to
    // its owner in the UI; it just can't be pushed. Counted in the log line.
    return owner && userIds.includes(owner) ? [owner] : [];
  }
  return [...userIds];
}

/** Body copy for a reminder: its notes, or a restatement of when it's due. */
function bodyFor(reminder: Reminder, now: Date): string {
  const notes = reminder.notes?.trim();
  if (notes) return notes;
  const due = formatDueAt(reminder.due_at, now);
  return due ? `Due ${due}.` : 'This reminder is due.';
}

/**
 * Where tapping the notification lands. An app-raised reminder points at the app
 * that raised it — a bin reminder belongs on the Home page — and falls back to
 * the reminders tab when that app is unknown to this instance.
 *
 * The registry lookup is guarded because it *throws* when the registry hasn't
 * been installed, and this is the one line in a delivery run that consults it.
 * The scheduler reads the registry to find this hook at all, so in the running
 * server it is always installed; that's exactly why a failure here would be an
 * unexpected one, and losing a night's notifications over a click-through path
 * is not a trade worth making.
 */
function urlFor(reminder: Reminder): string {
  const fallback = '/events?tab=reminders';
  if (!reminder.type) return fallback;
  try {
    return getAppById(reminder.type)?.web?.basePath ?? fallback;
  } catch {
    return fallback;
  }
}

/** Build the handler for one of the two daily firings. */
export function createReminderNotifier(slot: ReminderSlot): CronHandler {
  return async ({ token, firedAt, log }: CronContext) => {
    const hs = serverClient(token);
    const now = new Date(firedAt);
    const cutoff = windowEnd(slot, now);
    const floor = new Date(now.getTime() - MAX_LOOKBACK_DAYS * 86_400_000);

    const reminders = await hs.collection<Reminder>(REMINDERS).listAll();
    const due = reminders.filter((reminder) => {
      if (reminder.status === 'done') return false;
      const dueAt = new Date(reminder.due_at).getTime();
      if (Number.isNaN(dueAt)) return false;
      return dueAt <= cutoff.getTime() && dueAt >= floor.getTime();
    });

    if (due.length === 0) {
      await log(`no reminders due (scanned ${reminders.length})`);
      return { slot, reminders: reminders.length, due: 0, sent: 0 };
    }

    const users = await hs.collection<{ id: string }>('users').listAll();
    const userIds = users.map((user) => user.id);

    // Recipients first, so each user's inbox is read exactly once no matter how
    // many reminders address them.
    const byUser = new Map<string, Reminder[]>();
    let unaddressed = 0;
    for (const reminder of due) {
      const recipients = recipientsFor(reminder, userIds);
      if (recipients.length === 0) {
        unaddressed++;
        continue;
      }
      for (const userId of recipients) {
        const list = byUser.get(userId);
        if (list) list.push(reminder);
        else byUser.set(userId, [reminder]);
      }
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const [userId, userReminders] of byUser) {
      const prior = await hs
        .collection('users')
        .record(userId)
        .collection<NotificationRow>(NOTIFICATIONS)
        .listAll({ filter: `source_collection == '${REMINDERS}'` });
      const alreadySent = new Set(
        prior.map((row) => `${row.source_id ?? ''}|${row.scheduled_for ?? ''}`),
      );

      for (const reminder of userReminders) {
        const key = `${reminder.id}|${reminder.due_at}`;
        if (alreadySent.has(key)) {
          skipped++;
          continue;
        }

        const res = await sendNotificationToUser(token, userId, {
          title: reminder.title,
          body: bodyFor(reminder, now),
          tag: `reminder-${reminder.id}`,
          url: urlFor(reminder),
          sourceCollection: REMINDERS,
          sourceId: reminder.id,
          notificationType: 'reminder',
          scheduledFor: reminder.due_at,
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

    await log(
      `slot=${slot} reminders=${reminders.length} due=${due.length} recipients=${byUser.size} sent=${sent} skipped=${skipped} failed=${failed} unaddressed=${unaddressed}`,
    );
    return {
      slot,
      reminders: reminders.length,
      due: due.length,
      recipients: byUser.size,
      sent,
      skipped,
      failed,
      unaddressed,
    };
  };
}
