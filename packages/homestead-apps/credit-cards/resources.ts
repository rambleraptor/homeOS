import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';

export const CREDIT_CARDS = 'credit-cards' as const;
export const CREDIT_CARD_PERKS = 'perks' as const;
export const PERK_REDEMPTIONS = 'redemptions' as const;

export const creditCardsResources: ResourceDefinition[] = [
  {
    singular: 'credit-card',
    plural: CREDIT_CARDS,
    description:
      'A credit card account tracked for annual-fee value analysis.',
    user_settable_create: true,
    fields: {
      name: { type: 'string', required: true },
      issuer: { type: 'string', required: true },
      last_four: { type: 'string', pattern: '^[0-9]{4}$' },
      annual_fee: { type: 'number', required: true, minimum: 0 },
      anniversary_date: {
        type: 'string',
        format: 'date-time',
        required: true,
      },
      reset_mode: {
        type: 'string',
        enum: ['calendar_year', 'anniversary'],
        required: true,
      },
      notes: { type: 'string' },
      archived: { type: 'boolean' },
      created_by: { type: 'string', reference: { resource: 'user' } },
    },
  },
  {
    singular: 'perk',
    plural: CREDIT_CARD_PERKS,
    description:
      'A benefit/credit attached to a credit card (e.g. monthly dining credit).',
    user_settable_create: true,
    parents: ['credit-card'],
    fields: {
      name: { type: 'string', required: true },
      value: { type: 'number', required: true, exclusiveMinimum: 0 },
      frequency: {
        type: 'string',
        enum: ['monthly', 'quarterly', 'semi_annual', 'annual'],
        required: true,
      },
      category: {
        type: 'string',
        enum: [
          'travel',
          'dining',
          'streaming',
          'credits',
          'insurance',
          'lounge',
          'other',
        ],
      },
      notes: { type: 'string' },
      created_by: { type: 'string', reference: { resource: 'user' } },
    },
  },
  {
    singular: 'redemption',
    plural: PERK_REDEMPTIONS,
    description:
      'A single redemption of a credit card perk during its validity window.',
    user_settable_create: true,
    parents: ['perk'],
    fields: {
      period_start: { type: 'string', format: 'date-time', required: true },
      period_end: { type: 'string', format: 'date-time', required: true },
      amount: { type: 'number', required: true },
      notes: { type: 'string' },
      created_by: { type: 'string', reference: { resource: 'user' } },
    },
  },
];
