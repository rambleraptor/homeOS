import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';

export const HSA_RECEIPTS = 'hsa-receipts' as const;

export const hsaResources: ResourceDefinition[] = [
  {
    singular: 'hsa-receipt',
    plural: HSA_RECEIPTS,
    description:
      'A receipt for an HSA-eligible expense (for later reimbursement tracking).',
    user_settable_create: true,
    fields: {
      merchant: { type: 'string', required: true },
      service_date: { type: 'string', format: 'date-time', required: true },
      amount: { type: 'number', required: true },
      category: {
        type: 'string',
        enum: ['Medical', 'Dental', 'Vision', 'Rx'],
        required: true,
      },
      patient: { type: 'string' },
      status: {
        type: 'string',
        enum: ['Stored', 'Reimbursed'],
        required: true,
      },
      // Optional: a receipt captured manually carries its own file, but one
      // created from a classified document links back via `source_document`
      // instead (the document already stores the file — no need to duplicate it).
      receipt_file: {
        type: 'file',
        description: 'Receipt file (jpeg/png/webp/gif/pdf, <=10MB)',
      },
      // When present, `documents/{id}` of the document this receipt was derived
      // from. Its file stands in for a missing `receipt_file`.
      source_document: {
        type: 'string',
        description: 'Path of the source document this receipt was derived from.',
      },
      notes: { type: 'string' },
      created_by: { type: 'string', reference: { resource: 'user' } },
    },
    // AEP-136 custom method on the hsa-receipt collection. Long-running
    // (AEP-151): returns 202 + a pollable operation rather than blocking on
    // the AI parse.
    //   POST /api/aep/hsa-receipts:parse-receipt
    customMethods: {
      'parse-receipt': {
        target: 'collection',
        async: true,
        title: 'Parse receipt',
        load: () => import('./methods/parse-receipt'),
      },
    },
  },
];
