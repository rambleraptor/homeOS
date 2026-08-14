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

import { useState, type ChangeEvent } from 'react';
import { Upload, X } from 'lucide-react';
import { SchemaForm } from '@rambleraptor/homestead-core/shared/forms';
import type { FieldWidgetProps } from '@rambleraptor/homestead-core/shared/forms';
import type { HSAReceiptFormData } from '../types';
import { hsaResources } from '../resources';

const hsaReceiptDef = hsaResources.find((r) => r.singular === 'hsa-receipt')!;

const RECEIPT_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];
const MAX_RECEIPT_BYTES = 10_485_760; // 10MB

/** Image-or-PDF file field: dashed upload target → filename chip + remove, with
 *  inline type/size validation. Bare (owns its own label + error line). */
function ReceiptFileWidget(p: FieldWidgetProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const file = p.value instanceof File ? p.value : null;

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!RECEIPT_FILE_TYPES.includes(f.type)) {
      setLocalError('Invalid file type. Please upload an image or PDF.');
      p.onChange(null);
      return;
    }
    if (f.size > MAX_RECEIPT_BYTES) {
      setLocalError('File size must be less than 10MB');
      p.onChange(null);
      return;
    }
    setLocalError(null);
    p.onChange(f);
  };

  const error = localError ?? p.error;

  return (
    <div>
      <label htmlFor={p.id} className="block text-sm font-medium text-gray-700 mb-1">
        {p.config?.label ?? 'Receipt File'}
        {p.required && <span className="text-red-500"> *</span>}
      </label>
      {!file ? (
        <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-accent-terracotta transition-colors">
          <Upload className="w-5 h-5 text-gray-400 mr-2" />
          <span className="text-sm text-gray-600">Upload receipt (Image or PDF, max 10MB)</span>
          <input
            type="file"
            id={p.id}
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            onChange={onFile}
            className="hidden"
          />
        </label>
      ) : (
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg">
          <span className="text-sm text-gray-700 truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => {
              setLocalError(null);
              p.onChange(null);
            }}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

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
          collection: 'people',
          testId: 'hsa-receipt-person',
          emptyMessage: 'No people found — add them in the People app.',
        },
        receipt_file: {
          id: 'receipt_file',
          label: 'Receipt File',
          widget: ReceiptFileWidget,
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
