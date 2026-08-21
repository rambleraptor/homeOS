/**
 * HSA Quick Capture Form
 *
 * Manual create path for an HSA receipt, built on `SchemaForm` over the
 * hsa-receipt schema. The receipt file uses a bare custom widget (image/PDF,
 * 10MB) since that UX is richer than the built-in file input; `status` is not
 * shown and defaults to `Stored`. e2e selectors (`#merchant`/`#amount`/
 * `#category`/`#receipt_file`, `hsa-receipt-form-submit`, `hsa-receipt-person`)
 * are preserved.
 */

import { SchemaForm, fileField } from '@rambleraptor/homestead-core/shared/forms';
import { PersonReferenceField } from '../../people/components/PersonReferenceField';
import type { HSAReceiptFormData } from '../types';
import { hsaResources } from '../resources';

const hsaReceiptDef = hsaResources.find((r) => r.singular === 'hsa-receipt')!;

/** Image-or-PDF receipt upload (10MB): a filename chip for a PDF, a thumbnail
 *  for an image, both with inline validation. Module-scoped for stable identity. */
const receiptFileField = fileField({
  accept: 'image/jpeg,image/png,image/webp,image/gif,application/pdf',
  maxSizeBytes: 10_485_760,
  hint: 'Image or PDF, max 10MB',
  preview: 'auto',
});

interface HSAQuickCaptureFormProps {
  onSubmit: (data: HSAReceiptFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function HSAQuickCaptureForm({
  onSubmit,
  onCancel,
  isSubmitting,
}: HSAQuickCaptureFormProps) {
  return (
    <SchemaForm<HSAReceiptFormData>
      resource={hsaReceiptDef}
      mode="create"
      onSubmit={(data) => onSubmit({ ...data, status: 'Stored' })}
      onCancel={onCancel}
      isSubmitting={isSubmitting}
      submitTestId="hsa-receipt-form-submit"
      submitLabel="Save Receipt"
      fields={{
        merchant: { id: 'merchant', placeholder: "Doctor's Office, Pharmacy, etc." },
        service_date: { id: 'service_date', label: 'Service Date' },
        amount: { id: 'amount', widget: 'currency', placeholder: '0.00' },
        category: { id: 'category', default: 'Medical', enumLabels: { Rx: 'Rx (Prescription)' } },
        patient: { id: 'patient', placeholder: 'Self, Spouse, Child, etc.' },
        person: {
          id: 'person',
          widget: PersonReferenceField,
          bare: true,
          collection: 'people',
          testId: 'hsa-receipt-person',
          emptyMessage: 'No people found — add them in the People app.',
        },
        receipt_file: {
          id: 'receipt_file',
          label: 'Receipt File',
          widget: receiptFileField,
          bare: true,
          required: true,
          colSpan: 2,
        },
        notes: {
          id: 'notes',
          widget: 'textarea',
          colSpan: 2,
          placeholder: 'Additional notes about this expense...',
        },
        status: { hidden: true },
        source_document: { hidden: true },
      }}
    />
  );
}
