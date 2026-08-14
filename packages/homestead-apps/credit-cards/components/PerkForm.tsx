/**
 * Perk Form
 *
 * Modal-wrapped `SchemaForm` over the perk schema. `credit_card` is the parent
 * (URL-encoded, not a schema field), so it's injected into the payload here;
 * the Modal closes on a successful save. e2e selectors (`perk-form`, `#perk-*`,
 * `perk-form-submit`) are preserved.
 */

import { Modal } from '@rambleraptor/homestead-core/shared/components/Modal';
import { SchemaForm } from '@rambleraptor/homestead-core/shared/forms';
import type { PerkFormData, CreditCardPerk } from '../types';
import { creditCardsResources } from '../resources';

const perkDef = creditCardsResources.find((r) => r.singular === 'perk')!;

interface PerkFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PerkFormData) => Promise<void>;
  creditCardId: string;
  initialData?: CreditCardPerk;
  isSubmitting: boolean;
}

export function PerkForm({
  isOpen,
  onClose,
  onSubmit,
  creditCardId,
  initialData,
  isSubmitting,
}: PerkFormProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? 'Edit Perk' : 'Add Perk'}>
      <SchemaForm<PerkFormData>
        resource={perkDef}
        mode={initialData ? 'edit' : 'create'}
        initialData={initialData}
        onSubmit={async (data) => {
          await onSubmit({ ...data, credit_card: creditCardId });
          onClose();
        }}
        onCancel={onClose}
        isSubmitting={isSubmitting}
        testId="perk-form"
        submitTestId="perk-form-submit"
        submitLabel={initialData ? 'Update Perk' : 'Add Perk'}
        fields={{
          name: {
            id: 'perk-name',
            label: 'Perk Name',
            colSpan: 2,
            placeholder: 'e.g. Dining Credit, Uber Cash',
            autoFocus: true,
          },
          value: {
            id: 'perk-value',
            widget: 'currency',
            label: 'Value per Period',
            placeholder: '0.00',
          },
          frequency: {
            id: 'perk-frequency',
            label: 'Frequency',
            default: 'monthly',
            enumLabels: { semi_annual: 'Semi-Annual' },
          },
          category: { id: 'perk-category', label: 'Category' },
          notes: {
            id: 'perk-notes',
            widget: 'textarea',
            colSpan: 2,
            placeholder: 'Optional notes...',
          },
        }}
      />
    </Modal>
  );
}
