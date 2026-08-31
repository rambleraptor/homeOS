import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';

export const VACCINES = 'vaccines' as const;
export const VACCINATIONS = 'vaccinations' as const;

export const healthResources: ResourceDefinition[] = [
  {
    singular: 'vaccine',
    plural: VACCINES,
    description:
      "One vaccine series the record's owner tracks (e.g. Tdap, Influenza, " +
      'COVID-19) — the top-line grouping for their dose history, and the home ' +
      'of series-level state like when the next dose is due. Health records ' +
      'are personal: each user sees only the vaccines they created.',
    // Health information is private to the person it belongs to. Every row is
    // reachable only by its owner (engine-set `_owner`) unless they explicitly
    // share it via a record grant — household members never see each other's
    // records by default. Two users who both get Tdap each have their own
    // `Tdap` row; that duplication is what keeps series-level state private.
    access: { model: 'private' },
    user_settable_create: true,
    fields: {
      name: {
        type: 'string',
        required: true,
        description:
          'name of the vaccine or series, e.g. "Tdap", "COVID-19", "Influenza"',
      },
      // Who the series is FOR — the household person the doses were given to,
      // which for a document parsed from email may not be the account that
      // owns the record. Distinct from ownership: `created_by`/`_owner` (the
      // account) still governs visibility; `person` is the subject. One person
      // can have many series; the same vaccine for two people is two series.
      // Stored as a bare person id (like documents' `people`), which is what
      // the engine's `set-null` enforcement matches.
      person: {
        type: 'string',
        reference: { resource: 'person', onDelete: 'set-null' },
        description:
          'id of the person this series belongs to (the patient). Optional — unset when the subject is unknown.',
      },
      next_due: {
        type: 'string',
        format: 'date',
        description:
          'when the next dose or booster of this series is due as ISO YYYY-MM-DD; ' +
          'drives the due-soon list. Leave unset when the series is complete.',
      },
      notes: { type: 'string' },
      created_by: { type: 'string', reference: { resource: 'user' } },
    },
  },
  {
    singular: 'vaccination',
    plural: VACCINATIONS,
    // A dose belongs to its series: /vaccines/{id}/vaccinations/{id}. The
    // parent id lives in the URL, not a stored field, and deleting a vaccine
    // force-cascades its doses.
    parents: ['vaccine'],
    description:
      'One administered dose of a vaccine, stored under the vaccine series it ' +
      'belongs to. As private as its parent: only the owner sees it.',
    access: { model: 'private' },
    user_settable_create: true,
    fields: {
      date_administered: {
        type: 'string',
        format: 'date',
        required: true,
        description:
          'the day the dose was given as ISO YYYY-MM-DD. A plain date, not a timestamp — ISO dates sort lexically so order_by works.',
      },
      dose: {
        type: 'string',
        description: 'which dose in the series, e.g. "1 of 2", "booster"',
      },
      provider: {
        type: 'string',
        description: 'clinic, pharmacy, or doctor that administered the dose',
      },
      lot_number: {
        type: 'string',
        description: 'vaccine lot number printed on the record, if known',
      },
      record_image: {
        type: 'file',
        description: 'photo or scan of the vaccine card / record; jpeg, png, or pdf, max 5MB',
      },
      // Doses are usually captured from an uploaded document (a vaccine
      // record PDF in the Documents app) rather than a direct photo; one
      // document can hold several doses, so many vaccinations may share it.
      // `set-null` clears the link when the document is deleted. Documents are
      // private to their owner too, so the link never crosses users.
      document: {
        type: 'string',
        reference: { resource: 'document', onDelete: 'set-null' },
        description:
          'id of the document this dose was captured from (e.g. an uploaded vaccine record PDF); several vaccinations can share one document',
      },
      notes: { type: 'string' },
      created_by: { type: 'string', reference: { resource: 'user' } },
    },
  },
];
