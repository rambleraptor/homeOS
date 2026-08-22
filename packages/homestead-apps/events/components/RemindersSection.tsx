/**
 * The Reminders tab — read-only, and on its way out.
 *
 * Reminders have moved to the notifications app as `scheduled-notification`
 * rows: one per recipient, delivered by a dispatcher that runs every minute
 * rather than at two fixed hours. See
 * `packages/homestead-site/docs/design/scheduled-notifications.md`.
 *
 * **Why this is read-only rather than gone.** The `notifications-adopt-reminders`
 * migration ran once, at the boot that introduced the queue, and carried every
 * hand-typed reminder still ahead of it into the new collection. A reminder
 * created *after* that would never be adopted — it would sit in a collection
 * nothing delivers from and the next release drops. So the write paths close
 * here and the list stays, as a record of what was, until the `reminder`
 * definition is removed.
 *
 * Rows an app raised aren't listed at all any more: their producers rebuild
 * them as scheduled notifications on every run, so they're live over in the
 * Scheduled tab and the copies here are stale by definition.
 */

import { BellRing } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@rambleraptor/homestead-core/shared/components/Badge';
import { SectionCard } from '@rambleraptor/homestead-core/shared/components/SectionCard';
import { Spinner } from '@rambleraptor/homestead-core/shared/components/Spinner';
import { useReminders } from '../hooks/useReminders';
import { formatDueAt } from '../utils/reminderDate';
import { isAppReminder, type Reminder } from '../types';

/** Where reminders live now. */
const SCHEDULED_PATH = '/notifications?tab=scheduled';

function isDone(reminder: Reminder): boolean {
  return reminder.status === 'done';
}

export function RemindersSection() {
  const { data: reminders = [], isLoading } = useReminders();

  // App-raised rows are excluded rather than folded away: the apps that wrote
  // them now write scheduled notifications instead, so these are leftovers.
  const listed = reminders.filter((reminder) => !isAppReminder(reminder));

  return (
    <SectionCard icon={BellRing} title="Reminders">
      <div
        className="mb-4 rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900"
        data-testid="reminders-moved-banner"
      >
        <p className="font-medium">Reminders have moved.</p>
        <p className="mt-1">
          Everything still due was copied to{' '}
          <Link to={SCHEDULED_PATH} className="underline font-medium">
            Notifications → Scheduled
          </Link>
          , where you can add, edit and cancel them. This list is kept for
          reference and will be removed.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : listed.length === 0 ? (
        <p className="text-center text-gray-600 py-8" data-testid="reminders-empty">
          Nothing here. New reminders live in{' '}
          <Link to={SCHEDULED_PATH} className="underline">
            Notifications → Scheduled
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-2" data-testid="reminders-list">
          {listed.map((reminder) => {
            const complete = isDone(reminder);
            return (
              <li
                key={reminder.id}
                data-testid={`reminder-row-${reminder.id}`}
                className="rounded-lg border border-gray-100 p-3"
              >
                <p
                  className={`font-medium ${
                    complete ? 'text-gray-400 line-through' : 'text-gray-900'
                  }`}
                >
                  {reminder.title}
                  {complete && (
                    <span className="ml-2 align-middle">
                      <Badge variant="neutral">done</Badge>
                    </span>
                  )}
                </p>
                <p
                  data-testid={`reminder-due-${reminder.id}`}
                  className="text-sm text-gray-600 mt-0.5"
                >
                  {formatDueAt(reminder.due_at)}
                </p>
                {reminder.notes && (
                  <p className="text-sm text-gray-500 mt-1 whitespace-pre-line">
                    {reminder.notes}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
