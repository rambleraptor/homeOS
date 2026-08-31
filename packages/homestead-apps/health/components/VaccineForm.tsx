/**
 * Vaccine (series) form — name, next due date, notes. Built on `SchemaForm`
 * over the vaccine schema.
 */

import { SchemaForm } from '@rambleraptor/homestead-core/shared/forms';
import type { Vaccine, VaccineFormData } from '../types';
import { healthResources } from '../resources';

const vaccineDef = healthResources.find((r) => r.singular === 'vaccine')!;

interface VaccineFormProps {
  onSubmit: (data: VaccineFormData) => void;
  onCancel: () => void;
  initialData?: Vaccine;
  isSubmitting?: boolean;
}

export function VaccineForm({
  onSubmit,
  onCancel,
  initialData,
  isSubmitting = false,
}: VaccineFormProps) {
  const mode = initialData ? 'edit' : 'create';
  return (
    <SchemaForm<VaccineFormData>
      resource={vaccineDef}
      mode={mode}
      initialData={initialData}
      onSubmit={onSubmit}
      onCancel={onCancel}
      isSubmitting={isSubmitting}
      testId="vaccine-form"
      submitTestId="vaccine-form-submit"
      cancelTestId="vaccine-form-cancel"
      submitLabel={mode === 'edit' ? 'Update' : 'Add Vaccine'}
      fields={{
        name: {
          id: 'name',
          colSpan: 2,
          placeholder: 'e.g. Tdap, COVID-19, Influenza',
          autoFocus: true,
        },
        next_due: {
          id: 'next_due',
          label: 'Next Dose Due',
          help: 'Leave blank when the series is complete.',
        },
        notes: { id: 'vaccine_notes', widget: 'textarea', colSpan: 2 },
      }}
    />
  );
}
