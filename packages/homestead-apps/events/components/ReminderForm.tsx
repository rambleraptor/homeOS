/**
 * Create / edit form for a standalone reminder.
 *
 * Runs through the shared `useSchemaForm` engine for validation and submit,
 * like `EventForm`. The reminder's UI shape diverges from its schema in one
 * place: `due_at` is a single stored instant, but entered as a required date
 * plus an optional time (see `utils/reminderDate`), so both controls are
 * declared as extra fields and `buildPayload` recombines them.
 */

import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import { Input } from '@rambleraptor/homestead-core/shared/components/Input';
import { useSchemaForm } from '@rambleraptor/homestead-core/shared/forms';
import { eventsResources } from '../resources';
import { DEFAULT_HOUR, fromDueAt, toDueAt } from '../utils/reminderDate';
import type { Reminder, ReminderFormData, ReminderVisibility } from '../types';

const reminderDef = eventsResources.find((r) => r.singular === 'reminder')!;

interface ReminderFormProps {
  initialData?: Reminder;
  onSubmit: (data: ReminderFormData) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

/** `ReminderFormData` plus the split due-date controls. */
type ReminderFormValues = ReminderFormData & {
  dueDate: string;
  dueTime: string;
};

const VISIBILITY_OPTIONS: ReadonlyArray<{
  value: ReminderVisibility;
  label: string;
  hint: string;
}> = [
  { value: 'household', label: 'Everyone', hint: 'The whole household sees this' },
  { value: 'private', label: 'Just me', hint: 'Only you see this' },
];

export function ReminderForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
}: ReminderFormProps) {
  const initialDue = fromDueAt(initialData?.due_at);

  const form = useSchemaForm<ReminderFormValues>({
    resource: reminderDef,
    initialData: {
      title: initialData?.title ?? '',
      notes: initialData?.notes ?? '',
      dueDate: initialDue.date,
      dueTime: initialDue.time,
      visibility: initialData?.visibility ?? 'household',
    },
    fields: {
      title: { id: 'reminder-title' },
      // Assembled from dueDate + dueTime in buildPayload.
      due_at: { hidden: true },
      // Not editable here: the section's checkbox owns it.
      status: { hidden: true },
      // Rendered by hand below, and only when creating.
      visibility: { hidden: true },
    },
    extraFields: {
      dueDate: { type: 'string', required: true },
      dueTime: { type: 'string' },
    },
    validate: (values) => {
      const date = String(values.dueDate ?? '').trim();
      if (!date) return { dueDate: 'A due date is required' };
      if (!toDueAt(date, String(values.dueTime ?? ''))) {
        return { dueDate: 'Enter a real date and time' };
      }
      return null;
    },
    buildPayload: (v) => {
      const notes = String(v.notes ?? '').trim();
      const payload: ReminderFormData = {
        title: String(v.title ?? '').trim(),
        // `validate` has already rejected an unparseable pair, so the fallback
        // is unreachable — it exists so the type stays honest.
        due_at:
          toDueAt(String(v.dueDate ?? ''), String(v.dueTime ?? '')) ??
          new Date().toISOString(),
      };
      if (notes !== '') {
        payload.notes = notes;
      } else if (initialData) {
        // Editing and notes were cleared — send null so merge-patch drops it.
        payload.notes = null;
      }
      // Create-only: an update carrying it is a 400.
      if (!initialData) {
        payload.visibility = (v.visibility as ReminderVisibility) ?? 'household';
      }
      return payload as unknown as Record<string, unknown>;
    },
    onSubmit,
  });

  const busy = isSubmitting || form.isSubmitting;

  return (
    <form onSubmit={form.handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="reminder-title"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Reminder <span className="text-red-500">*</span>
        </label>
        <Input
          id="reminder-title"
          data-testid="reminder-form-title"
          type="text"
          placeholder="e.g. Call the plumber"
          value={(form.values.title as string) ?? ''}
          onChange={(e) => form.setValue('title', e.target.value)}
          error={form.errors.title}
          required
        />
      </div>

      <div>
        <label
          htmlFor="reminder-form-date"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Due <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="reminder-form-date"
            aria-label="Due date"
            data-testid="reminder-form-date"
            type="date"
            value={(form.values.dueDate as string) ?? ''}
            onChange={(e) => form.setValue('dueDate', e.target.value)}
            error={form.errors.dueDate}
            required
          />
          <Input
            aria-label="Due time (optional)"
            data-testid="reminder-form-time"
            type="time"
            value={(form.values.dueTime as string) ?? ''}
            onChange={(e) => form.setValue('dueTime', e.target.value)}
          />
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {`The time is optional — reminders without one are due at ${DEFAULT_HOUR}:00.`}
        </p>
      </div>

      <div>
        <label
          htmlFor="reminder-form-notes"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Notes
        </label>
        <textarea
          id="reminder-form-notes"
          data-testid="reminder-form-notes"
          rows={3}
          value={(form.values.notes as string) ?? ''}
          onChange={(e) => form.setValue('notes', e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>

      {!initialData && (
        <div>
          <span className="block text-sm font-medium text-gray-700 mb-1">
            Who is this for?
          </span>
          <div className="flex gap-2" role="radiogroup" aria-label="Who is this for?">
            {VISIBILITY_OPTIONS.map((opt) => {
              const selected =
                ((form.values.visibility as string) ?? 'household') === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  title={opt.hint}
                  onClick={() => form.setValue('visibility', opt.value)}
                  data-testid={`reminder-form-visibility-${opt.value}`}
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    selected
                      ? 'border-brand-navy bg-gray-50 text-brand-navy font-medium'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            This can’t be changed later — delete and re-add the reminder to switch.
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={busy} data-testid="reminder-form-submit">
          {busy ? 'Saving...' : initialData ? 'Update' : 'Create'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
