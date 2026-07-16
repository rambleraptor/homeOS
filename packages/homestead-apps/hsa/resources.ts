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
      receipt_file: {
        type: 'file',
        description: 'Receipt file (jpeg/png/webp/gif/pdf, <=10MB)',
        required: true,
      },
      notes: { type: 'string' },
      created_by: { type: 'string' },
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
