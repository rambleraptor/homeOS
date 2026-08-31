/**
 * Vaccination Form
 *
 * Built on `SchemaForm` over the vaccination schema. The record image uses
 * the shared `fileField` widget: thumbnail/chip preview of a freshly-picked
 * file, or the stored image on edit (resolved via `useVaccinationImageUrl`,
 * keyed off the record passed through `config.data`).
 */

import { SchemaForm, fileField } from '@rambleraptor/homestead-core/shared/forms';
import { MAX_IMAGE_SIZE } from '@rambleraptor/homestead-core/shared/constants/validation';
import type { Vaccination, VaccinationFormData } from '../types';
import { useVaccinationImageUrl } from '../hooks/useVaccinationImageUrl';
import { healthResources } from '../resources';

const vaccinationDef = healthResources.find((r) => r.singular === 'vaccination')!;

/** Record-image field: images or a PDF, max 5MB. Module-scoped for stable identity. */
const recordImageField = fileField({
  accept: 'image/jpeg,image/png,image/webp,application/pdf',
  maxSizeBytes: MAX_IMAGE_SIZE,
  hint: 'Photo or scan of the vaccine card — image or PDF, max 5MB',
  useRemoteUrl: (p) =>
    useVaccinationImageUrl((p.config?.data as Vaccination | undefined) ?? null),
});

interface VaccinationFormProps {
  onSubmit: (data: VaccinationFormData) => void;
  onCancel: () => void;
  initialData?: Vaccination;
  isSubmitting?: boolean;
}

/** The reference widget trades in `documents/{id}` paths; the wire field
 *  stores the bare id (what the engine's `set-null` enforcement matches). */
const toDocumentRef = (id: string | undefined): string =>
  id ? `documents/${id}` : '';
const fromDocumentRef = (ref: string | undefined): string =>
  ref?.startsWith('documents/') ? ref.slice('documents/'.length) : (ref ?? '');

export function VaccinationForm({
  onSubmit,
  onCancel,
  initialData,
  isSubmitting = false,
}: VaccinationFormProps) {
  const mode = initialData ? 'edit' : 'create';
  return (
    <SchemaForm<VaccinationFormData>
      resource={vaccinationDef}
      mode={mode}
      initialData={
        initialData
          ? { ...initialData, document: toDocumentRef(initialData.document) }
          : undefined
      }
      onSubmit={(data) =>
        onSubmit({ ...data, document: fromDocumentRef(data.document) })
      }
      onCancel={onCancel}
      isSubmitting={isSubmitting}
      testId="vaccination-form"
      submitTestId="vaccination-form-submit"
      cancelTestId="vaccination-form-cancel"
      submitLabel={mode === 'edit' ? 'Update' : 'Add Record'}
      fields={{
        vaccine: {
          id: 'vaccine',
          colSpan: 2,
          placeholder: 'e.g. Tdap, COVID-19 (Moderna), Influenza',
          autoFocus: true,
        },
        date_administered: { id: 'date_administered', label: 'Date Administered' },
        dose: { id: 'dose', placeholder: 'e.g. 1 of 2, booster' },
        provider: { id: 'provider', placeholder: 'Clinic, pharmacy, or doctor' },
        lot_number: { id: 'lot_number', label: 'Lot Number' },
        next_due: {
          id: 'next_due',
          label: 'Next Dose Due',
          help: 'Leave blank when the series is complete.',
        },
        document: {
          id: 'document',
          colSpan: 2,
          label: 'Source Document',
          labelField: 'title',
          help: 'Link the uploaded record this came from — several doses can share one document.',
          emptyMessage: 'No documents yet — upload one in the Documents app first.',
        },
        notes: { id: 'notes', widget: 'textarea', colSpan: 2 },
        record_image: {
          widget: recordImageField,
          data: initialData,
          bare: true,
          colSpan: 2,
          label: 'Record Image',
          testId: 'vaccination-form-image',
        },
      }}
    />
  );
}
