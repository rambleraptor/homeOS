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

import { useEffect, useState, type ChangeEvent } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { SchemaForm } from '@rambleraptor/homestead-core/shared/forms';
import type { FieldWidgetProps } from '@rambleraptor/homestead-core/shared/forms';
import { useToast } from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import { validateImageFile } from '@rambleraptor/homestead-core/shared/utils/fileValidation';
import type { GiftCard, GiftCardFormData } from '../types';
import { useGiftCardImageUrl } from '../hooks/useGiftCardImageUrl';
import { giftCardsResources } from '../resources';

const giftCardDef = giftCardsResources.find((r) => r.singular === 'gift-card')!;

/** Card-image field: shows the stored image on edit, a picked file's preview,
 *  or a dashed upload target; validates via the shared image validator. Bare. */
function GiftCardImageWidget(p: FieldWidgetProps) {
  const toast = useToast();
  const card = p.config?.data as GiftCard | undefined;
  const field = p.name as 'front_image' | 'back_image';
  const isFront = field === 'front_image';
  const remoteUrl = useGiftCardImageUrl(card ?? null, field);

  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    return () => {
      if (uploadUrl) URL.revokeObjectURL(uploadUrl);
    };
  }, [uploadUrl]);

  const preview = uploadUrl ?? (hidden ? null : remoteUrl);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const validation = validateImageFile(f);
    if (!validation.valid) {
      toast.error(validation.error!);
      return;
    }
    p.onChange(f);
    setUploadUrl(URL.createObjectURL(f));
    setHidden(false);
  };

  const remove = () => {
    p.onChange(null);
    setUploadUrl(null);
    setHidden(true);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {p.config?.label ?? (isFront ? 'Front Image' : 'Back Image')}
      </label>
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt={isFront ? 'Front of gift card' : 'Back of gift card'}
            className="w-full h-48 object-cover rounded-lg border border-gray-300"
          />
          <button
            type="button"
            onClick={remove}
            className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
            title="Remove image"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-accent-terracotta transition-colors">
          <Upload className="w-8 h-8 text-gray-400 mb-2" />
          <span className="text-sm text-gray-500">
            {isFront ? 'Upload front image' : 'Upload back image'}
          </span>
          <span className="text-xs text-gray-400 mt-1">(Optional, max 5MB)</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={onFile}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}

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
        front_image: { widget: GiftCardImageWidget, data: initialData, bare: true, label: 'Front Image' },
        back_image: { widget: GiftCardImageWidget, data: initialData, bare: true, label: 'Back Image' },
        archived: { hidden: true },
      }}
    />
  );
}
