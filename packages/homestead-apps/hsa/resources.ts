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
      amount: { type: 'number', required: true, exclusiveMinimum: 0 },
      category: {
        type: 'string',
        enum: ['Medical', 'Dental', 'Vision', 'Rx'],
        required: true,
      },
      // Free-text name as printed on the receipt. Being phased out in favour of
      // the canonical `person` link below, but kept for now so existing receipts
      // keep their label.
      patient: { type: 'string' },
      // Canonical link to a `person` record. Different receipts can print the
      // same patient's name differently (maiden name, middle name, nickname);
      // linking to one person collapses those variants so they group and filter
      // together. Stored as a `people/{id}` path.
      person: {
        type: 'string',
        reference: { resource: 'person', onDelete: 'set-null' },
      },
      status: {
        type: 'string',
        enum: ['Stored', 'Reimbursed'],
        required: true,
        // A freshly captured receipt is Stored until reimbursed. Declared as a
        // schema default so every create path (the quick-capture form, which
        // no longer renders a status control, plus chat/import) lands on Stored
        // without each having to set it.
        default: 'Stored',
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
  },
];
