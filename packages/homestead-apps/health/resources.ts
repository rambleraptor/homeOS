import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';

export const VACCINATIONS = 'vaccinations' as const;

export const healthResources: ResourceDefinition[] = [
  {
    singular: 'vaccination',
    plural: VACCINATIONS,
    description:
      "One vaccine dose received by the record's owner. Health records are " +
      'personal: each user sees only the records they created.',
    // Health information is private to the person it belongs to. Every row is
    // reachable only by its owner (engine-set `_owner`) unless they explicitly
    // share it via a record grant — household members never see each other's
    // records by default.
    access: { model: 'private' },
    user_settable_create: true,
    fields: {
      vaccine: {
        type: 'string',
        required: true,
        description:
          'name of the vaccine as it appears on the record, e.g. "Tdap", "COVID-19 (Moderna)", "Influenza"',
      },
      date_administered: {
        type: 'string',
        format: 'date',
        required: true,
        description:
          'the day the dose was given as ISO YYYY-MM-DD. A plain date, not a timestamp — ISO dates sort lexically so order_by works.',
      },
      dose: {
        type: 'string',
        description: 'which dose in a series, e.g. "1 of 2", "booster"',
      },
      provider: {
        type: 'string',
        description: 'clinic, pharmacy, or doctor that administered the dose',
      },
      lot_number: {
        type: 'string',
        description: 'vaccine lot number printed on the record, if known',
      },
      next_due: {
        type: 'string',
        format: 'date',
        description:
          'when the next dose or booster is due as ISO YYYY-MM-DD; drives the due-soon list. Leave unset when the series is complete.',
      },
      record_image: {
        type: 'file',
        description: 'photo or scan of the vaccine card / record; jpeg, png, or pdf, max 5MB',
      },
      // Records are usually captured from an uploaded document (a vaccine
      // record PDF in the Documents app) rather than a direct photo; one
      // document can hold several doses, so many vaccinations may share it.
      // `set-null` clears the link when the document is deleted. Documents are
      // private to their owner too, so the link never crosses users.
      document: {
        type: 'string',
        reference: { resource: 'document', onDelete: 'set-null' },
        description:
          'id of the document this record was captured from (e.g. an uploaded vaccine record PDF); several vaccinations can share one document',
      },
      notes: { type: 'string' },
      created_by: { type: 'string', reference: { resource: 'user' } },
    },
  },
];
