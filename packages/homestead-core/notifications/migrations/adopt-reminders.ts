/**
 * `notifications-adopt-reminders` migration.
 *
 * Carries hand-typed `reminder` rows into the delivery queue, so nothing
 * somebody wrote by hand is lost when the collection goes away.
 *
 * **Only hand-typed ones.** A reminder an app raised (`type` set — bin night,
 * an event a week out, a closing perk window) is *derived*: its producer
 * recomputes the whole horizon from the source record on every run, and all
 * three producers declare `runOnStart: true`, so those rows are rebuilt within
 * seconds of the boot this migration runs on. Adopting them would mean racing
 * that rebuild for no gain — the migration and the producer would both be
 * creating rows for the same occurrence, with nothing to tell them apart. So
 * the rule is: if something else knows how to recreate it, let it.
 *
 * That leaves the rows nothing else can recreate, and they are the ones worth
 * the trouble.
 *
 * **Fan-out is the actual work.** A `reminder` was one household row that named
 * its audience in a field; a scheduled notification is one row per recipient,
 * parented under that person. The audience rules are replayed here in the same
 * precedence the delivery cron used: an explicit `notify_users`, else the owner
 * of a `private` row, else everybody.
 *
 * This is the one place a hand-typed household reminder still reaches the whole
 * house. That's deliberate: what stops is *creating* new ones that way — the
 * browser can only write under the signed-in user — not honouring the ones
 * already there.
 *
 * **Idempotent** on `(user, source_key)`, keyed by the reminder's id. A crash
 * partway through re-runs safely, and because no adopted row carries a
 * `source_app`, no producer's reconcile will ever see, patch, or withdraw one.
 *
 * Server-only: lives under `migrations/`, so vite stubs it out of the browser
 * bundle. Runs once at boot with a short-lived admin token.
 */

import type { MigrationHandler } from '@rambleraptor/homestead-core/apps/migrations';
import { serverClient } from '@rambleraptor/homestead-core/server/client';
import { SCHEDULED_NOTIFICATIONS } from '../constants';
import type { ScheduledNotification } from '../types';

/**
 * The legacy collection. Named here rather than imported: the events app owns
 * it today and won't once it's dropped, and a migration that outlives its
 * source resource shouldn't hold a compile-time reference to it.
 */
const REMINDERS = 'reminders';

/** Prefix on an adopted row's `source_key`, so converted rows stay recognisable. */
const ADOPTED_PREFIX = 'adopted:';

/** The shape this migration reads off the legacy collection. */
export interface LegacyReminder {
  id: string;
  title: string;
  notes?: string;
  due_at: string;
  status?: string;
  visibility?: string;
  /** Id of the app that raised it. Unset means a person typed it in. */
  type?: string;
  notify_users?: string[];
  created_by?: string;
}

/** Strip a `users/abc` style reference down to the bare id. */
function bareId(value: string | undefined): string {
  if (!value) return '';
  const slash = value.lastIndexOf('/');
  return slash === -1 ? value : value.slice(slash + 1);
}

/**
 * Who this reminder was for, in the delivery cron's precedence order. Ids that
 * don't match a current user are dropped, so a deleted account can't strand a
 * row under a parent that no longer exists.
 */
export function recipientsFor(
  reminder: LegacyReminder,
  userIds: readonly string[],
): string[] {
  const explicit = (reminder.notify_users ?? [])
    .map(bareId)
    .filter((id) => userIds.includes(id));
  if (explicit.length > 0) return explicit;

  if (reminder.visibility === 'private') {
    const owner = bareId(reminder.created_by);
    // A private reminder with no `created_by` is unaddressable: the engine's
    // `_owner` column isn't exposed over the API, so there is nobody to parent
    // the row under. It was never deliverable either, for the same reason.
    return owner && userIds.includes(owner) ? [owner] : [];
  }
  return [...userIds];
}

/** The `source_key` an adopted row carries. Stable, so re-runs are no-ops. */
export function adoptedKey(reminder: Pick<LegacyReminder, 'id'>): string {
  return `${ADOPTED_PREFIX}${reminder.id}`;
}

/** True when this reminder is one a person wrote, and so worth carrying over. */
export function isHandTyped(reminder: LegacyReminder): boolean {
  return !reminder.type;
}

/**
 * True when the reminder still has a moment ahead of it. The queue holds what
 * hasn't happened; one whose instant has passed was either delivered or missed,
 * and re-queueing it would announce it late.
 */
export function isStillAhead(reminder: LegacyReminder, now: number): boolean {
  if (reminder.status === 'done') return false;
  const at = new Date(reminder.due_at).getTime();
  return !Number.isNaN(at) && at > now;
}

const migrate: MigrationHandler = async ({ token, log }) => {
  const hs = serverClient(token);

  let reminders: LegacyReminder[];
  try {
    reminders = await hs.collection<LegacyReminder>(REMINDERS).listAll();
  } catch {
    // The collection is already gone — a fresh instance, or one that ran this
    // before the definition was dropped. Nothing to carry over.
    await log('no reminders collection; nothing to adopt');
    return { scanned: 0, adopted: 0, rows: 0, skipped: 0 };
  }

  const users = await hs.collection<{ id: string }>('users').listAll();
  const userIds = users.map((user) => user.id);
  const now = Date.now();

  // One read per user up front, so the idempotency check is a set lookup rather
  // than a request per reminder per user. Safe against a concurrent producer:
  // adopted rows carry no `source_app`, so nothing else writes these keys.
  const existingKeys = new Map<string, Set<string>>();
  for (const userId of userIds) {
    const rows = await hs
      .collection('users')
      .record(userId)
      .collection<ScheduledNotification>(SCHEDULED_NOTIFICATIONS)
      .listAll();
    existingKeys.set(
      userId,
      new Set(rows.map((row) => row.source_key).filter(Boolean) as string[]),
    );
  }

  let adopted = 0;
  let rows = 0;
  let skipped = 0;

  for (const reminder of reminders) {
    if (!isHandTyped(reminder) || !isStillAhead(reminder, now)) {
      skipped++;
      continue;
    }

    const recipients = recipientsFor(reminder, userIds);
    if (recipients.length === 0) {
      skipped++;
      continue;
    }

    const key = adoptedKey(reminder);
    let wrote = false;
    for (const userId of recipients) {
      if (existingKeys.get(userId)?.has(key)) continue;
      await hs
        .collection('users')
        .record(userId)
        .collection(SCHEDULED_NOTIFICATIONS)
        .create({
          title: reminder.title,
          // `message` is required; a reminder's notes were optional, so fall
          // back to the title rather than writing an empty string.
          message: reminder.notes?.trim() || reminder.title,
          send_at: new Date(reminder.due_at).toISOString(),
          status: 'scheduled',
          // No `source_app`: this is a person's row now, editable in the
          // Scheduled tab like anything else they schedule.
          source_key: key,
          source_collection: REMINDERS,
          source_id: reminder.id,
        });
      existingKeys.get(userId)?.add(key);
      rows++;
      wrote = true;
    }
    if (wrote) adopted++;
  }

  await log(
    `scanned=${reminders.length} adopted=${adopted} rows=${rows} skipped=${skipped}`,
  );
  return { scanned: reminders.length, adopted, rows, skipped };
};

export default migrate;
