/**
 * HSA Receipt Edit Form
 *
 * Edits the metadata of an existing receipt (merchant, date, amount, category,
 * status, patient/person, notes). The receipt file itself isn't editable here —
 * updates go over a JSON PATCH, and swapping the stored file needs a multipart
 * upload — so the file/AI-parse flow stays in the quick-capture form.
 */

import { useState } from 'react';
import { ReferenceField } from '@rambleraptor/homestead-core/shared/components/ReferenceField';
import type {
  HSAReceipt,
  ReceiptCategory,
  ReceiptStatus,
} from '../types';

interface HSAReceiptEditFormProps {
  receipt: HSAReceipt;
  onSubmit: (data: Partial<HSAReceipt>) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

/** Fields the edit form manages. Kept separate from create's `HSAReceiptFormData`
 *  (which carries a `File`); edits are metadata-only. */
interface EditFields {
  merchant: string;
  service_date: string;
  amount: number;
  category: ReceiptCategory;
  status: ReceiptStatus;
  patient: string;
  person: string;
  notes: string;
}

/** A stored `service_date` may be a full ISO datetime; a `type="date"` input
 *  wants `YYYY-MM-DD`. */
function toDateInputValue(value: string): string {
  return value ? value.slice(0, 10) : '';
}

export function HSAReceiptEditForm({
  receipt,
  onSubmit,
  onCancel,
  isSubmitting,
}: HSAReceiptEditFormProps) {
  const [fields, setFields] = useState<EditFields>({
    merchant: receipt.merchant,
    service_date: toDateInputValue(receipt.service_date),
    amount: receipt.amount,
    category: receipt.category,
    status: receipt.status,
    patient: receipt.patient ?? '',
    person: receipt.person ?? '',
    notes: receipt.notes ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (fields.amount <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    try {
      await onSubmit({
        merchant: fields.merchant,
        service_date: fields.service_date,
        amount: fields.amount,
        category: fields.category,
        status: fields.status,
        patient: fields.patient,
        person: fields.person,
        notes: fields.notes,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update receipt');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Merchant */}
        <div>
          <label htmlFor="edit-merchant" className="block text-sm font-medium text-gray-700 mb-1">
            Merchant <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="edit-merchant"
            required
            value={fields.merchant}
            onChange={(e) => setFields({ ...fields, merchant: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-terracotta focus:border-accent-terracotta"
            placeholder="Doctor's Office, Pharmacy, etc."
          />
        </div>

        {/* Service Date */}
        <div>
          <label htmlFor="edit-service_date" className="block text-sm font-medium text-gray-700 mb-1">
            Service Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="edit-service_date"
            required
            value={fields.service_date}
            onChange={(e) => setFields({ ...fields, service_date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-terracotta focus:border-accent-terracotta"
          />
        </div>

        {/* Amount */}
        <div>
          <label htmlFor="edit-amount" className="block text-sm font-medium text-gray-700 mb-1">
            Amount <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-500">$</span>
            <input
              type="number"
              id="edit-amount"
              required
              min="0.01"
              step="0.01"
              value={fields.amount || ''}
              onChange={(e) => setFields({ ...fields, amount: parseFloat(e.target.value) || 0 })}
              className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-terracotta focus:border-accent-terracotta"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label htmlFor="edit-category" className="block text-sm font-medium text-gray-700 mb-1">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            id="edit-category"
            required
            value={fields.category}
            onChange={(e) => setFields({ ...fields, category: e.target.value as ReceiptCategory })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-terracotta focus:border-accent-terracotta"
          >
            <option value="Medical">Medical</option>
            <option value="Dental">Dental</option>
            <option value="Vision">Vision</option>
            <option value="Rx">Rx (Prescription)</option>
          </select>
        </div>

        {/* Status */}
        <div>
          <label htmlFor="edit-status" className="block text-sm font-medium text-gray-700 mb-1">
            Status <span className="text-red-500">*</span>
          </label>
          <select
            id="edit-status"
            required
            value={fields.status}
            onChange={(e) => setFields({ ...fields, status: e.target.value as ReceiptStatus })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-terracotta focus:border-accent-terracotta"
          >
            <option value="Stored">Stored</option>
            <option value="Reimbursed">Reimbursed</option>
          </select>
        </div>

        {/* Patient */}
        <div>
          <label htmlFor="edit-patient" className="block text-sm font-medium text-gray-700 mb-1">
            Patient
          </label>
          <input
            type="text"
            id="edit-patient"
            value={fields.patient}
            onChange={(e) => setFields({ ...fields, patient: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-terracotta focus:border-accent-terracotta"
            placeholder="Self, Spouse, Child, etc."
          />
        </div>

        {/* Person — canonical link to a People record. */}
        <ReferenceField
          id="edit-person"
          label="Person"
          collection="people"
          value={fields.person ? [fields.person] : []}
          onChange={(paths) => setFields({ ...fields, person: paths[0] ?? '' })}
          placeholder="Search people…"
          emptyMessage="No people found — add them in the People app."
          testId="hsa-receipt-edit-person"
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="edit-notes" className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          id="edit-notes"
          value={fields.notes}
          onChange={(e) => setFields({ ...fields, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-terracotta focus:border-accent-terracotta"
          placeholder="Additional notes about this expense..."
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          data-testid="hsa-receipt-edit-submit"
          className="px-4 py-2 bg-accent-terracotta hover:bg-accent-terracotta-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </form>
  );
}
