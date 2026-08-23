/**
 * `credit-cards-drop-perk-reminders` migration.
 *
 * Cleans up after the withdrawn perk-window reminders. Two jobs, and both exist
 * because removing a producer is not the same as removing what it produced.
 *
 * **1. Withdraw the queued notifications.** The perk cron wrote scheduled
 * notifications up to 30 days ahead, and the thing that would normally take
 * them back is that same cron's next reconcile — which is gone. Left alone they
 * would keep firing for a month after the feature was removed, and the only way
 * to stop them would be cancelling each one by hand. They're deleted rather than
 * cancelled: cancelling exists so a materializer can't resurrect a row, and
 * there is no materializer left to resurrect these. Rows that already fired are
 * left alone — they're the record of what was sent.
 *
 * **2. Clear the per-user opt-in.** Dropping the `perk_reminder` user setting
 * removes the `credit_cards__perk_reminder` column from `user-preference`, and
 * the engine refuses to drop a column that still holds values. Unlike the
 * resource sync, the user-settings syncer sends no authorized-drops header, so
 * a `drops:` declaration on this migration would not help it — the only way
 * through is to leave the column empty. Migrations run *before* the
 * user-settings sync in `syncSchema`, so clearing here means the drop lands on
 * the same boot rather than erroring once and converging on the next one.
 *
 * Idempotent both ways: a second run finds no queued rows and no values left.
 *
 * Server-only: lives under `migrations/`, so vite stubs it out of the browser
 * bundle.
 */

import type { MigrationHandler } from '@rambleraptor/homestead-core/apps/migrations';
import { serverClient } from '@rambleraptor/homestead-core/server/client';
import { SCHEDULED_NOTIFICATIONS } from '@rambleraptor/homestead-core/notifications/constants';
import { USER_PREFERENCES } from '@rambleraptor/homestead-core/resources/builtins';
import type { ScheduledNotification } from '@rambleraptor/homestead-core/notifications/types';

/** The `source_app` the withdrawn cron stamped on everything it queued. */
const PERK_SOURCE_APP = 'credit-cards';

/**
 * The flattened `user-preference` column behind the opt-in — `appId` with
 * dashes swapped for underscores, then the setting key. Spelled out rather than
 * derived, because the module that defined the key is deleted and a migration
 * must keep working long after the code that motivated it is gone.
 */
export const PERK_REMINDER_FIELD = 'credit_cards__perk_reminder';

interface PreferenceRow {
  id: string;
  [key: string]: unknown;
}

const migrate: MigrationHandler = async ({ token, log }) => {
  const hs = serverClient(token);
  const users = await hs.collection<{ id: string }>('users').listAll();

  let withdrawn = 0;
  let cleared = 0;

  for (const user of users) {
    const userRecord = hs.collection('users').record(user.id);

    const queue = userRecord.collection<ScheduledNotification>(SCHEDULED_NOTIFICATIONS);
    for (const row of await queue.listAll()) {
      if (row.source_app !== PERK_SOURCE_APP) continue;
      // Only what hasn't happened. A delivered or missed row is history.
      if (row.status !== 'scheduled') continue;
      await queue.record(row.id).delete();
      withdrawn++;
    }

    const prefs = userRecord.collection<PreferenceRow>(USER_PREFERENCES);
    for (const pref of await prefs.listAll()) {
      if (pref[PERK_REMINDER_FIELD] === undefined || pref[PERK_REMINDER_FIELD] === null) {
        continue;
      }
      // Merge-patch with an explicit null clears the column.
      await prefs.record(pref.id).update({ [PERK_REMINDER_FIELD]: null });
      cleared++;
    }
  }

  await log(`users=${users.length} withdrawn=${withdrawn} cleared=${cleared}`);
  return { users: users.length, withdrawn, cleared };
};

export default migrate;
