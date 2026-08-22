/**
 * The dispatcher — the one place a notification is actually delivered.
 *
 * Once a minute it looks for scheduled notifications whose moment has arrived,
 * sends each one, and stamps the outcome back onto the row. Nothing else in
 * Homestead pushes on a schedule: an app that wants to tell somebody something
 * later writes a row (see `server/scheduled-notifications.ts`) and this handler
 * decides how and whether it goes out.
 *
 * **Minute granularity is the point.** The reminder crons this replaces fired
 * at exactly 09:00 and 18:00, so every reminder had to be rounded to one of two
 * slots and a nine-hour delivery window had to be reasoned about (`windowEnd`,
 * `MAX_LOOKBACK_DAYS`, a morning handler and an evening one). Here "bins out at
 * six" is `send_at: 18:00` and arrives at 18:00, and the producers that used to
 * import `EVENING_HOUR` from the events app just write the hour they mean.
 *
 * **The row is the ledger.** Delivery state lives on the row being delivered,
 * so idempotency is a column read rather than a reconstruction: the old crons
 * loaded every prior inbox notification per user and rebuilt a
 * `source_id|scheduled_for` set to work out what had already gone out. A
 * `runOnStart` catch-up, a restart mid-tick, or a producer re-running its plan
 * can't double-send here, because the send and the status write bracket each
 * other on one row. The one bad case left — a crash between the push landing
 * and the PATCH — resends once, which is strictly better than the old worst
 * case (a failed inbox write meant resending on *every* subsequent firing).
 *
 * **Lateness is not silence.** A row found more than {@link LATE_GRACE_HOURS}
 * past its moment is marked `missed` rather than sent: telling someone about
 * last night's bins over breakfast is noise, but doing it silently means nobody
 * ever learns the box was down. `missed` is visible in the Scheduled tab and in
 * this cron's operation log.
 *
 * Server-only: lives under `crons/`, so vite stubs it out of the browser bundle.
 */

import type { CollectionRef } from '@rambleraptor/homestead-client';
import type { CronHandler } from '@rambleraptor/homestead-core/apps/types';
import { serverClient } from '@rambleraptor/homestead-core/server/client';
import { sendNotificationToUser } from '@rambleraptor/homestead-core/server/notifications';
import { SCHEDULED_NOTIFICATIONS } from '../constants';
import type { ScheduledNotification } from '../types';

/**
 * How late a notification can be and still be worth sending. Past this the row
 * is marked `missed`. Twelve hours keeps an overnight outage's morning
 * reminders (still useful when the box comes back at 8am) while dropping
 * yesterday's, which is the boundary the old seven-day lookback got wrong —
 * it was that generous only because its delivery windows were nine hours wide.
 */
export const LATE_GRACE_HOURS = 12;

/**
 * Attempts before a row is given up on. A push failure is usually transient
 * (VAPID misconfigured, the engine briefly unreachable), so the row stays
 * `scheduled` and the next tick retries — a minute later, not a day.
 */
export const MAX_ATTEMPTS = 3;

/** Fallback click-through when a row doesn't name one. */
const DEFAULT_URL = '/notifications';

const HOUR_MS = 3_600_000;

interface DispatchOutcome {
  users: number;
  due: number;
  sent: number;
  missed: number;
  retried: number;
  failed: number;
}

const handler: CronHandler = async ({ token, firedAt, log }) => {
  const hs = serverClient(token);
  const now = new Date(firedAt);
  const nowIso = now.toISOString();
  const graceFloor = now.getTime() - LATE_GRACE_HOURS * HOUR_MS;

  const users = await hs.collection<{ id: string }>('users').listAll();
  const outcome: DispatchOutcome = {
    users: users.length,
    due: 0,
    sent: 0,
    missed: 0,
    retried: 0,
    failed: 0,
  };

  for (const user of users) {
    const rows = hs
      .collection('users')
      .record(user.id)
      .collection<ScheduledNotification>(SCHEDULED_NOTIFICATIONS);

    // `send_at` is stored normalized to UTC (see `toUtcInstant`), which is what
    // makes this string comparison a time comparison.
    const due = await rows.listAll({
      filter: `status == 'scheduled' && send_at <= '${nowIso}'`,
    });
    outcome.due += due.length;

    for (const row of due) {
      const at = new Date(row.send_at).getTime();
      if (Number.isNaN(at)) {
        // Unparseable instant: it can never come due sensibly, and leaving it
        // `scheduled` means re-reading it every minute forever.
        await rows.record(row.id).update({
          status: 'failed',
          last_error: `unparseable send_at "${row.send_at}"`,
        });
        outcome.failed++;
        continue;
      }

      if (at < graceFloor) {
        await rows.record(row.id).update({ status: 'missed' });
        outcome.missed++;
        continue;
      }

      const attempts = (row.attempts ?? 0) + 1;
      let response: Response;
      try {
        response = await sendNotificationToUser(token, user.id, {
          title: row.title,
          body: row.message,
          tag: `scheduled-${row.id}`,
          url: row.url || DEFAULT_URL,
          sourceCollection: row.source_collection,
          sourceId: row.source_id,
          notificationType: 'reminder',
          scheduledFor: row.send_at,
        });
      } catch (error) {
        await recordFailure(rows, row, attempts, String(error), outcome);
        continue;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        await recordFailure(rows, row, attempts, body.slice(0, 500), outcome);
        continue;
      }

      const payload = (await response.json().catch(() => ({}))) as {
        notificationId?: string;
      };
      await rows.record(row.id).update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        attempts,
        notification_id: payload.notificationId,
      });
      outcome.sent++;
    }
  }

  // Quiet ticks are the norm — a minute cron that logged every firing would
  // bury the operations list — so only say something when something happened.
  if (outcome.due > 0) {
    await log(
      `due=${outcome.due} sent=${outcome.sent} missed=${outcome.missed} ` +
        `retried=${outcome.retried} failed=${outcome.failed}`,
    );
  }
  return { ...outcome };
};

/**
 * Record a failed attempt. Stays `scheduled` (so the next tick retries) until
 * the budget is spent, then goes `failed` so it stops being picked up and
 * starts being visible as a problem.
 */
async function recordFailure(
  rows: CollectionRef<ScheduledNotification>,
  row: ScheduledNotification,
  attempts: number,
  error: string,
  outcome: DispatchOutcome,
): Promise<void> {
  const exhausted = attempts >= MAX_ATTEMPTS;
  await rows.record(row.id).update({
    status: exhausted ? 'failed' : 'scheduled',
    attempts,
    last_error: error || 'delivery failed',
  });
  if (exhausted) outcome.failed++;
  else outcome.retried++;
}

export default handler;
