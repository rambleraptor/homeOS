/**
 * Create / edit form for a recurring upkeep task.
 *
 * Driven by `SchemaForm` over the `home-task` schema, so the cadence, due date,
 * and lead time validate against exactly what the engine will accept. The only
 * shaping done here is presentational: friendlier labels for the interval
 * enum, a textarea for the notes (which are the point — filter size, vendor
 * number — not an afterthought), and `paused` left out entirely because it's a
 * row action, not something you fill in while creating a schedule.
 */

import { SchemaForm } from '@rambleraptor/homestead-core/shared/forms';
import { homeResources } from '../resources';
import { todayIso } from '../utils/homeTasks';
import type { HomeTask, HomeTaskFormData } from '../types';

const homeTaskDef = homeResources.find((r) => r.singular === 'home-task')!;

interface HomeTaskFormProps {
  initialData?: HomeTask;
  onSubmit: (data: HomeTaskFormData) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function HomeTaskForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: HomeTaskFormProps) {
  const mode = initialData ? 'edit' : 'create';

  return (
    <SchemaForm<HomeTaskFormData>
      resource={homeTaskDef}
      mode={mode}
      initialData={initialData}
      onSubmit={onSubmit}
      onCancel={onCancel}
      isSubmitting={isSubmitting}
      testId="home-task-form"
      submitTestId="home-task-form-submit"
      cancelTestId="home-task-form-cancel"
      submitLabel={mode === 'edit' ? 'Save reminder' : 'Add reminder'}
      fields={{
        name: {
          id: 'home-task-name',
          label: 'Task',
          colSpan: 2,
          placeholder: 'e.g. Replace furnace filter',
          autoFocus: true,
          order: 1,
        },
        interval_count: {
          id: 'home-task-interval-count',
          label: 'Repeats every',
          order: 2,
        },
        interval_unit: {
          id: 'home-task-interval-unit',
          label: 'Unit',
          enumLabels: {
            day: 'Days',
            week: 'Weeks',
            month: 'Months',
            year: 'Years',
          },
          order: 3,
        },
        next_due: {
          id: 'home-task-next-due',
          label: 'Next due',
          default: todayIso(),
          help: 'Marking the task done moves this forward by one interval.',
          order: 4,
        },
        lead_days: {
          id: 'home-task-lead-days',
          label: 'Remind me this many days early',
          help: '0 sends the reminder on the morning it’s due.',
          order: 5,
        },
        notes: {
          id: 'home-task-notes',
          label: 'Notes',
          widget: 'textarea',
          colSpan: 2,
          placeholder: 'Filter size, vendor phone number, part number…',
          help: 'Whatever you’ll want in hand when the reminder arrives.',
          order: 6,
        },
        // A row action ("Pause"), not something you fill in while creating one.
        paused: { hidden: true },
        // Owned by the Done button — never typed.
        last_completed: { hidden: true },
      }}
    />
  );
}
