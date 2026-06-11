import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';

export const GIFT_CARDS = 'gift-cards' as const;
export const GIFT_CARD_TRANSACTIONS = 'transactions' as const;

export const giftCardsResources: ResourceDefinition[] = [
  {
    singular: 'gift-card',
    plural: GIFT_CARDS,
    description: 'A stored-value gift card owned by the household.',
    user_settable_create: true,
    fields: {
      merchant: { type: 'string', required: true },
      card_number: { type: 'string', required: true },
      pin: { type: 'string' },
      amount: { type: 'number', required: true },
      notes: { type: 'string' },
      archived: { type: 'boolean' },
      front_image: {
        type: 'file',
        description: 'Front-of-card image (jpeg/png/webp/gif, <=5MB)',
      },
      back_image: {
        type: 'file',
        description: 'Back-of-card image (jpeg/png/webp/gif, <=5MB)',
      },
      created_by: { type: 'string', description: 'users/{user_id}' },
    },
  },
  {
    singular: 'transaction',
    plural: GIFT_CARD_TRANSACTIONS,
    description: 'A balance change recorded against a gift card.',
    user_settable_create: true,
    parents: ['gift-card'],
    fields: {
      transaction_type: {
        type: 'string',
        enum: ['decrement', 'set'],
        required: true,
      },
      previous_amount: { type: 'number', required: true },
      new_amount: { type: 'number', required: true },
      amount_changed: { type: 'number', required: true },
      notes: { type: 'string' },
      created_by: { type: 'string' },
    },
  },
];
