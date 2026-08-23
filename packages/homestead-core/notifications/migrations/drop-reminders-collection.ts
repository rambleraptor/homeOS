/**
 * `notifications-drop-reminders-collection` migration.
 *
 * Deletes the retired `reminder` collection, now that
 * `notifications-adopt-reminders` has carried everything worth keeping into the
 * queue. This is the last step of the two-release retirement — the definition
 * came out of `events/resources.ts` in the same release, and this removes what
 * it left behind.
 *
 * **Why a migration is needed at all.** Removing a definition from the declared
 * set does *not* delete anything: `syncResourceDefinitions` only creates,
 * patches, and no-ops — it has no delete path. An undeclared resource is simply
 * unmanaged, and its table and rows sit in the database indefinitely. Nor does
 * a migration's `drops` list help: that authorizes dropping a *column* inside a
 * still-declared resource, and there is no resource-level equivalent. The only
 * way to remove a collection is to delete its definition through the engine,
 * which is what this does.
 *
 * **Ordering is the safety property**, and it is why this lives in the
 * notifications app rather than in events, where the resource came from.
 * Migrations run in app-registration order and, within an app, in array order —
 * so declaring this immediately after `notifications-adopt-reminders` in the
 * same `migrations` array is the only way to guarantee the adoption reads the
 * collection before this deletes it. Filed under events it would run *earlier*
 * (events registers before the core apps), and a single instance upgrading
 * across both releases at once would lose every hand-typed reminder.
 *
 * **This is destructive and unrecoverable.** `removeResource` does a
 * `DROP TABLE`, taking every remaining row with it: reminders that were done,
 * already past, or raised by an app. That is the intent — those were history or
 * scaffolding, and the ones with a future were adopted. There is no undo, which
 * is why the release ships only after the adoption has run everywhere.
 *
 * Server-only: lives under `migrations/`, so vite stubs it out of the browser
 * bundle.
 */

import type { MigrationHandler } from '@rambleraptor/homestead-core/apps/migrations';
import { AEPBASE_URL } from '@rambleraptor/homestead-core/server/aepbase';

/** The retired definition's id, which is its `singular`. */
const REMINDER_DEFINITION = 'reminder';

const DEFINITIONS_PATH = 'aep-resource-definitions';

const migrate: MigrationHandler = async ({ token, log }) => {
  const url = `${AEPBASE_URL}/${DEFINITIONS_PATH}/${REMINDER_DEFINITION}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) {
    // Already gone — a fresh instance that never had the collection, or a
    // re-run after the ledger failed to record success.
    await log('reminder definition already absent; nothing to drop');
    return { dropped: false, reason: 'absent' };
  }

  if (!res.ok) {
    const text = await res.text();
    // A 400 here means the engine refused: `removeResource` blocks a delete
    // while another resource declares this one as a parent. Nothing parents
    // `reminder`, so this would mean an app added one — worth failing loudly
    // rather than leaving a half-retired collection.
    throw new Error(
      `aepbase DELETE /${DEFINITIONS_PATH}/${REMINDER_DEFINITION} → ${res.status}: ${text}`,
    );
  }

  await log('dropped the reminder collection');
  return { dropped: true };
};

export default migrate;
