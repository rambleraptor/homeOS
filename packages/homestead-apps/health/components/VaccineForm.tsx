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

/** The reference widget trades in `people/{id}` paths; the wire field stores
 *  the bare id (what the engine's `set-null` enforcement matches). */
const toPersonRef = (id: string | undefined): string => (id ? `people/${id}` : '');
const fromPersonRef = (ref: string | undefined): string =>
  ref?.startsWith('people/') ? ref.slice('people/'.length) : (ref ?? '');

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
      initialData={
        initialData
          ? { ...initialData, person: toPersonRef(initialData.person) }
          : undefined
      }
      onSubmit={(data) => onSubmit({ ...data, person: fromPersonRef(data.person) })}
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
        person: {
          id: 'person',
          colSpan: 2,
          label: 'For',
          collection: 'people',
          labelField: 'name',
          help: 'Who this series belongs to (the patient).',
          emptyMessage: 'No people yet — add them in the People app first.',
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
