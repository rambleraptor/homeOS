/**
 * The Reminders tab.
 *
 * Two kinds of row share this list, and the split is what most of the code here
 * is about. A reminder someone typed in is the point of the page. A reminder an
 * *app* raised — an event a week out, tomorrow's bin night — is scaffolding: it
 * exists so the notification crons have something to deliver, and there can be
 * one per collection day per week. Left mixed in, the second kind buries the
 * first within a fortnight, so app reminders are folded away behind a count and
 * only unfold when someone asks what's queued up.
 *
 * App rows are also read-only here. Their content is reconciled from the source
 * record on every materializer run, so an edit would be silently reverted and a
 * delete would reappear tomorrow — the honest control is the checkbox, which
 * marks one done and stops the crons announcing it. What you actually want to
 * change is the thing behind it: the event's reminder setting, the pickup opt-in
 * on Home.
 *
 * Done reminders stay visible but collapse behind their own toggle — a reminder
 * you completed is worth seeing for a moment ("yes, I did that") and worth
 * hiding after that.
 */

import { useState } from 'react';
import { BellRing, Check, Edit, Lock, Plus, Trash2 } from 'lucide-react';
import { getAppById } from '@rambleraptor/homestead-core/apps/registry';
import { Badge } from '@rambleraptor/homestead-core/shared/components/Badge';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import { Checkbox } from '@rambleraptor/homestead-core/shared/components/Checkbox';
import { ConfirmDialog } from '@rambleraptor/homestead-core/shared/components/ConfirmDialog';
import { Modal } from '@rambleraptor/homestead-core/shared/components/Modal';
import { SectionCard } from '@rambleraptor/homestead-core/shared/components/SectionCard';
import { Spinner } from '@rambleraptor/homestead-core/shared/components/Spinner';
import { useToast } from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import { useReminders } from '../hooks/useReminders';
import { useCreateReminder } from '../hooks/useCreateReminder';
import { useUpdateReminder } from '../hooks/useUpdateReminder';
import { useDeleteReminder } from '../hooks/useDeleteReminder';
import { formatDueAt, isOverdue } from '../utils/reminderDate';
import { ReminderForm } from './ReminderForm';
import { isAppReminder, type Reminder, type ReminderFormData } from '../types';

function isDone(reminder: Reminder): boolean {
  return reminder.status === 'done';
}

/**
 * Display name of the app that raised a reminder. Falls back to the stored id:
 * an app can be uninstalled from an instance while the rows it wrote are still
 * on the list, and "events" beats a blank badge.
 */
function appLabel(type: string): string {
  return getAppById(type)?.name ?? type;
}

export function RemindersSection() {
  const { data: reminders = [], isLoading } = useReminders();
  const createReminder = useCreateReminder();
  const updateReminder = useUpdateReminder();
  const deleteReminder = useDeleteReminder();
  const toast = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [confirm, setConfirm] = useState<Reminder | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [showApp, setShowApp] = useState(false);

  const appRaised = reminders.filter(isAppReminder);
  const listed = showApp ? reminders : reminders.filter((r) => !isAppReminder(r));
  const pending = listed.filter((r) => !isDone(r));
  const done = listed.filter(isDone);
  const visible = showDone ? [...pending, ...done] : pending;

  const handleCreate = async (data: ReminderFormData) => {
    try {
      // `data` already carries the chosen `visibility` and `created_by` (both
      // create-only).
      await createReminder.mutateAsync({ ...data, status: 'pending' });
      setIsCreateOpen(false);
      toast.success('Reminder created');
    } catch {
      // Error surfaced by the global mutation error toast (queryClient.ts).
    }
  };

  const handleUpdate = async (data: ReminderFormData) => {
    if (!editing) return;
    try {
      await updateReminder.mutateAsync({ id: editing.id, data });
      setEditing(null);
      toast.success('Reminder updated');
    } catch {
      // Error surfaced by the global mutation error toast (queryClient.ts).
    }
  };

  const handleToggleDone = async (reminder: Reminder) => {
    try {
      await updateReminder.mutateAsync({
        id: reminder.id,
        data: { status: isDone(reminder) ? 'pending' : 'done' },
      });
    } catch {
      // Error surfaced by the global mutation error toast (queryClient.ts).
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirm) return;
    try {
      await deleteReminder.mutateAsync(confirm.id);
      setConfirm(null);
      toast.success('Reminder deleted');
    } catch {
      // Error surfaced by the global mutation error toast (queryClient.ts).
    }
  };

  return (
    <SectionCard
      icon={BellRing}
      title="Reminders"
      action={
        <div className="flex items-center gap-2">
          {appRaised.length > 0 && (
            <button
              type="button"
              onClick={() => setShowApp((v) => !v)}
              data-testid="reminders-toggle-app"
              className="text-sm text-gray-500 hover:text-brand-navy"
            >
              {showApp
                ? 'Hide app reminders'
                : `Show app reminders (${appRaised.length})`}
            </button>
          )}
          {done.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              data-testid="reminders-toggle-done"
              className="text-sm text-gray-500 hover:text-brand-navy"
            >
              {showDone ? 'Hide done' : `Show done (${done.length})`}
            </button>
          )}
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            data-testid="add-reminder-button"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Reminder
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : visible.length === 0 ? (
        <p className="text-center text-gray-600 py-8" data-testid="reminders-empty">
          {listed.length === 0
            ? 'No reminders yet. Add one for something that isn’t a yearly event.'
            : 'Nothing outstanding — every reminder is done.'}
        </p>
      ) : (
        <ul className="space-y-2" data-testid="reminders-list">
          {visible.map((reminder) => {
            const complete = isDone(reminder);
            const overdue = !complete && isOverdue(reminder.due_at);
            const fromApp = isAppReminder(reminder);
            return (
              <li
                key={reminder.id}
                data-testid={`reminder-row-${reminder.id}`}
                className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 p-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <Checkbox
                    checked={complete}
                    onCheckedChange={() => void handleToggleDone(reminder)}
                    aria-label={
                      complete
                        ? `Mark ${reminder.title} as not done`
                        : `Mark ${reminder.title} as done`
                    }
                    data-testid={`reminder-toggle-${reminder.id}`}
                    className="mt-1"
                  />
                  <div className="min-w-0">
                    <p
                      className={`font-medium truncate ${
                        complete ? 'text-gray-400 line-through' : 'text-gray-900'
                      }`}
                    >
                      {reminder.title}
                      {fromApp && (
                        <span
                          className="ml-2 align-middle"
                          data-testid={`reminder-app-${reminder.id}`}
                        >
                          <Badge variant="neutral">
                            {appLabel(reminder.type as string)}
                          </Badge>
                        </span>
                      )}
                      {reminder.visibility === 'private' && (
                        <span
                          data-testid={`reminder-private-${reminder.id}`}
                          title="Only you can see this"
                          className="ml-2 inline-flex items-center gap-1 align-middle text-xs font-normal text-gray-500"
                        >
                          <Lock className="w-3 h-3" aria-hidden="true" />
                          Just me
                        </span>
                      )}
                    </p>
                    <p
                      data-testid={`reminder-due-${reminder.id}`}
                      className={`text-sm mt-0.5 ${
                        overdue ? 'text-red-600' : 'text-gray-600'
                      }`}
                    >
                      {complete && (
                        <Check className="w-3.5 h-3.5 inline mr-1" aria-hidden="true" />
                      )}
                      {formatDueAt(reminder.due_at)}
                      {overdue && <span className="ml-2 font-medium">Overdue</span>}
                    </p>
                    {reminder.notes && (
                      <p className="text-sm text-gray-500 mt-1 whitespace-pre-line">
                        {reminder.notes}
                      </p>
                    )}
                  </div>
                </div>
                {!fromApp && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label={`Edit ${reminder.title}`}
                      onClick={() => setEditing(reminder)}
                      data-testid={`reminder-edit-${reminder.id}`}
                      className="p-2 rounded-md text-gray-500 hover:text-brand-navy hover:bg-gray-100"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${reminder.title}`}
                      onClick={() => setConfirm(reminder)}
                      data-testid={`reminder-delete-${reminder.id}`}
                      className="p-2 rounded-md text-gray-500 hover:text-red-600 hover:bg-gray-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Reminder"
      >
        <ReminderForm
          onSubmit={handleCreate}
          onCancel={() => setIsCreateOpen(false)}
          isSubmitting={createReminder.isPending}
        />
      </Modal>

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Edit Reminder">
        {editing && (
          <ReminderForm
            initialData={editing}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
            isSubmitting={updateReminder.isPending}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Reminder"
        message={
          confirm
            ? `Are you sure you want to delete "${confirm.title}"? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteReminder.isPending}
      />
    </SectionCard>
  );
}
