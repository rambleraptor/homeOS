/**
 * HSA Receipt Edit Form
 *
 * Edits an existing receipt's metadata via `SchemaForm` over the hsa-receipt
 * schema. The receipt file itself isn't editable here (updates go over a JSON
 * PATCH), so `receipt_file`/`source_document` are hidden. e2e selectors
 * (`#edit-*`, `hsa-receipt-edit-submit`, `hsa-receipt-edit-person`) preserved.
 */

import { SchemaForm } from '@rambleraptor/homestead-core/shared/forms';
import { PersonReferenceField } from '../../../people/components/PersonReferenceField';
import type { HSAReceipt } from '../types';
import { hsaResources } from '../resources';

const hsaReceiptDef = hsaResources.find((r) => r.singular === 'hsa-receipt')!;

interface HSAReceiptEditFormProps {
  receipt: HSAReceipt;
  onSubmit: (data: Partial<HSAReceipt>) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function HSAReceiptEditForm({
  receipt,
  onSubmit,
  onCancel,
  isSubmitting,
}: HSAReceiptEditFormProps) {
  return (
    <SchemaForm<Partial<HSAReceipt>>
      resource={hsaReceiptDef}
      mode="edit"
      initialData={receipt}
      onSubmit={onSubmit}
      onCancel={onCancel}
      isSubmitting={isSubmitting}
      submitTestId="hsa-receipt-edit-submit"
      submitLabel="Save Changes"
      layout={{
        order: [
          'merchant',
          'service_date',
          'amount',
          'category',
          'status',
          'patient',
          'person',
          'notes',
        ],
      }}
      fields={{
        merchant: { id: 'edit-merchant', placeholder: "Doctor's Office, Pharmacy, etc." },
        service_date: { id: 'edit-service_date', label: 'Service Date' },
        amount: { id: 'edit-amount', widget: 'currency', placeholder: '0.00' },
        category: { id: 'edit-category', enumLabels: { Rx: 'Rx (Prescription)' } },
        status: { id: 'edit-status' },
        patient: { id: 'edit-patient', placeholder: 'Self, Spouse, Child, etc.' },
        person: {
          id: 'edit-person',
          widget: PersonReferenceField,
          bare: true,
          collection: 'people',
          testId: 'hsa-receipt-edit-person',
          emptyMessage: 'No people found — add them in the People app.',
        },
        notes: {
          id: 'edit-notes',
          widget: 'textarea',
          colSpan: 2,
          placeholder: 'Additional notes about this expense...',
        },
        receipt_file: { hidden: true },
        source_document: { hidden: true },
      }}
    />
  );
}
