/**
 * Credit Card Form
 *
 * Generated from the credit-card schema via the shared `SchemaForm`. The
 * `fields` map is a sparse presentation diff — labels, placeholders, the
 * currency widget for the fee, and the edit-only `archived` toggle; validation
 * (required, `last_four` pattern, `annual_fee >= 0`) comes from the schema and
 * is enforced by the engine. The external props are unchanged, so callers and
 * the e2e selectors (`#card-*` ids, `credit-card-form*` test ids) are untouched.
 */

import { SchemaForm } from '@rambleraptor/homestead-core/shared/forms';
import type { CreditCardFormData, CreditCard } from '../types';
import { creditCardsResources } from '../resources';

const creditCardDef = creditCardsResources.find((r) => r.singular === 'credit-card')!;

interface CreditCardFormProps {
  initialData?: CreditCard;
  onSubmit: (data: CreditCardFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function CreditCardForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
}: CreditCardFormProps) {
  const mode = initialData ? 'edit' : 'create';
  return (
    <SchemaForm<CreditCardFormData>
      resource={creditCardDef}
      mode={mode}
      initialData={initialData}
      onSubmit={onSubmit}
      onCancel={onCancel}
      isSubmitting={isSubmitting}
      testId="credit-card-form"
      submitTestId="credit-card-form-submit"
      submitLabel={mode === 'edit' ? 'Update Card' : 'Add Card'}
      fields={{
        name: { id: 'card-name', label: 'Card Name', placeholder: 'e.g. Amex Gold', autoFocus: true },
        issuer: { id: 'card-issuer', placeholder: 'e.g. American Express' },
        last_four: { id: 'card-last-four', label: 'Last 4 Digits', placeholder: '1234' },
        annual_fee: {
          id: 'card-annual-fee',
          widget: 'currency',
          label: 'Annual Fee',
          placeholder: '0',
        },
        anniversary_date: { id: 'card-anniversary', label: 'Anniversary Date' },
        reset_mode: {
          id: 'card-reset-mode',
          label: 'Perk Reset Mode',
          default: 'calendar_year',
          enumLabels: {
            calendar_year: 'Calendar Year (Jan-Dec)',
            anniversary: 'Anniversary Date',
          },
        },
        notes: {
          id: 'card-notes',
          widget: 'textarea',
          colSpan: 2,
          placeholder: 'Optional notes about this card...',
        },
        archived: {
          id: 'card-archived',
          label: 'Archived (hidden from main view)',
          colSpan: 2,
          hidden: mode === 'create',
        },
      }}
    />
  );
}
