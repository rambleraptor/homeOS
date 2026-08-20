/**
 * Shared plumbing for apps that raise reminders on the household's behalf.
 *
 * An app doesn't send notifications. It **materializes**: once a day it works
 * out which reminders its own records imply over the next week or so, and hands
 * the list here. This module makes the stored `reminder` rows match — creating
 * what's missing, patching what drifted, withdrawing a future row nothing
 * implies any more — and the two reminder crons deliver whatever is due.
 *
 * The contract is a `source_key` per planned reminder: an app-unique, stable
 * string identifying *what the reminder is for* (`<event id>:day_of:2026`,
 * `pickup:2026-08-25`). Because a materializer runs daily over an overlapping
 * horizon, that key is the only thing standing between one reminder and seven
 * copies of it. It must be derived from the source record, never from the clock.
 *
 * Rows whose moment has already passed are left alone — they are the record of
 * what was announced, and the notify cron's inbox dedup means re-running can't
 * resend them — until `pruneAfterDays` sweeps them.
 *
 * Server-only: lives under `crons/`, so vite stubs it out of the browser bundle.
 */

import { serverClient } from '@rambleraptor/homestead-core/server/client';
import { REMINDERS } from '../resources';
import { bareId } from '../utils/referenceId';
import type { Reminder } from '../types';

/** A reminder a materializer believes should exist right now. */
export interface PlannedReminder {
  /** App-unique, stable key for what this reminder is about. */
  source_key: string;
  title: string;
  notes: string;
  /** RFC3339 instant. */
  due_at: string;
  /** Bare user ids to notify. Empty means the whole household. */
  notify_users: string[];
}

export interface ReconcileOptions {
  /** The firing's clock. */
  now: Date;
  /** How long a delivered reminder is kept before being swept. Default 30. */
  pruneAfterDays?: number;
}

export interface ReconcileResult {
  created: number;
  updated: number;
  unchanged: number;
  /** Future rows deleted because nothing implies them any more. */
  withdrawn: number;
  /** Long-past rows swept. */
  pruned: number;
}

/** True when the stored row already says what the plan says. */
function matches(stored: Reminder, planned: PlannedReminder): boolean {
  const storedUsers = (stored.notify_users ?? []).map(bareId).sort();
  const plannedUsers = [...planned.notify_users].sort();
  return (
    stored.title === planned.title &&
    stored.notes === planned.notes &&
    stored.due_at === planned.due_at &&
    storedUsers.length === plannedUsers.length &&
    storedUsers.every((id, i) => id === plannedUsers[i])
  );
}

/**
 * Make the `type`-stamped reminders match `planned`.
 *
 * Only rows carrying this `type` are touched — a materializer never sees, edits,
 * or sweeps a reminder a person wrote, or one another app raised.
 */
export async function reconcileReminders(
  token: string,
  type: string,
  planned: Map<string, PlannedReminder>,
  { now, pruneAfterDays = 30 }: ReconcileOptions,
): Promise<ReconcileResult> {
  const reminders = serverClient(token).collection<Reminder>(REMINDERS);
  const existing = (await reminders.listAll()).filter(
    (reminder) => reminder.type === type,
  );
  const bySourceKey = new Map(
    existing
      .filter((reminder) => reminder.source_key)
      .map((reminder) => [reminder.source_key as string, reminder]),
  );

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const plan of planned.values()) {
    const stored = bySourceKey.get(plan.source_key);
    if (!stored) {
      await reminders.create({
        title: plan.title,
        notes: plan.notes,
        due_at: plan.due_at,
        status: 'pending',
        visibility: 'household',
        type,
        source_key: plan.source_key,
        notify_users: plan.notify_users,
      });
      created++;
      continue;
    }
    if (matches(stored, plan)) {
      unchanged++;
      continue;
    }
    await reminders.record(stored.id).update({
      title: plan.title,
      notes: plan.notes,
      due_at: plan.due_at,
      notify_users: plan.notify_users,
    });
    updated++;
  }

  const pruneBefore = now.getTime() - pruneAfterDays * 86_400_000;
  let withdrawn = 0;
  let pruned = 0;

  for (const stored of existing) {
    const at = new Date(stored.due_at).getTime();
    if (Number.isNaN(at)) continue;
    if (at < pruneBefore) {
      await reminders.record(stored.id).delete();
      pruned++;
      continue;
    }
    // Only the future is reconciled: a row whose moment has passed stays as the
    // record of what was announced.
    if (at <= now.getTime()) continue;
    if (stored.source_key && planned.has(stored.source_key)) continue;
    await reminders.record(stored.id).delete();
    withdrawn++;
  }

  return { created, updated, unchanged, withdrawn, pruned };
}
