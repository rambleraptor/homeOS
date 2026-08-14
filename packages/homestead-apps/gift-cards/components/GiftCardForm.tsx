/**
 * Gift Card Form
 *
 * Built on `SchemaForm` over the gift-card schema. The two card images use a
 * bare custom widget that resolves the stored image (on edit) via
 * `useGiftCardImageUrl`, previews a freshly-picked file, and validates it with
 * the shared `validateImageFile` (images only, 5MB). Scalars stack full-width;
 * the images sit side by side. e2e selectors (`#merchant`/`#card_number`/
 * `#amount`, `gift-card-form-submit`, `gift-card-form-cancel`) are preserved.
 */

import { SchemaForm, fileField } from '@rambleraptor/homestead-core/shared/forms';
import { validateImageFile } from '@rambleraptor/homestead-core/shared/utils/fileValidation';
import { MAX_IMAGE_SIZE } from '@rambleraptor/homestead-core/shared/constants/validation';
import type { GiftCard, GiftCardFormData } from '../types';
import { useGiftCardImageUrl } from '../hooks/useGiftCardImageUrl';
import { giftCardsResources } from '../resources';

const giftCardDef = giftCardsResources.find((r) => r.singular === 'gift-card')!;

/** Card-image field (5MB, images only): thumbnail preview of a picked file or
 *  the stored image on edit (resolved via `useGiftCardImageUrl`, keyed off the
 *  edited card passed through `config.data`). Module-scoped for stable identity. */
const giftCardImageField = fileField({
  accept: 'image/jpeg,image/png,image/webp,image/gif',
  maxSizeBytes: MAX_IMAGE_SIZE,
  hint: 'Optional, max 5MB',
  preview: 'image',
  validate: (file) => {
    const result = validateImageFile(file);
    return result.valid ? null : (result.error ?? 'Invalid image');
  },
  useRemoteUrl: (p) =>
    useGiftCardImageUrl(
      (p.config?.data as GiftCard | undefined) ?? null,
      p.name as 'front_image' | 'back_image',
    ),
});

interface GiftCardFormProps {
  onSubmit: (data: GiftCardFormData) => void;
  onCancel: () => void;
  initialData?: GiftCard;
  isSubmitting?: boolean;
}

export function GiftCardForm({
  onSubmit,
  onCancel,
  initialData,
  isSubmitting = false,
}: GiftCardFormProps) {
  const mode = initialData ? 'edit' : 'create';
  return (
    <SchemaForm<GiftCardFormData>
      resource={giftCardDef}
      mode={mode}
      initialData={initialData}
      onSubmit={onSubmit}
      onCancel={onCancel}
      isSubmitting={isSubmitting}
      submitTestId="gift-card-form-submit"
      cancelTestId="gift-card-form-cancel"
      submitLabel={mode === 'edit' ? 'Update' : 'Add Card'}
      fields={{
        merchant: {
          id: 'merchant',
          colSpan: 2,
          placeholder: 'e.g., Amazon, Starbucks, Target',
          autoFocus: true,
        },
        card_number: {
          id: 'card_number',
          label: 'Card Number',
          colSpan: 2,
          placeholder: 'Enter card number',
        },
        pin: { id: 'pin', label: 'PIN', colSpan: 2, placeholder: 'Enter PIN (optional)' },
        amount: { id: 'amount', widget: 'currency', colSpan: 2, placeholder: '0.00' },
        notes: {
          id: 'notes',
          widget: 'textarea',
          colSpan: 2,
          placeholder: 'Any additional notes (optional)',
        },
        front_image: { widget: giftCardImageField, data: initialData, bare: true, label: 'Front Image' },
        back_image: { widget: giftCardImageField, data: initialData, bare: true, label: 'Back Image' },
        archived: { hidden: true },
      }}
    />
  );
}
