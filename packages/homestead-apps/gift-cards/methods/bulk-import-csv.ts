/**
 * Gift cards CSV import.
 *
 * Server-only (under `methods/`, so the client build stubs it out) — declared
 * as a format on the gift-card resource's `bulkImport`.
 */

import {
  createCsvParser,
  validateBoolean,
  validateCurrency,
  validateOptionalString,
  validateRequiredString,
  type CsvSchema,
} from '@rambleraptor/homestead-core/server/bulk-import/csv';

/**
 * A gift card as it comes from a CSV. `front_image`/`back_image` are absent:
 * they're file fields, which a CSV can't carry.
 */
export interface GiftCardImportData {
  merchant: string;
  card_number: string;
  pin?: string;
  amount: number;
  notes?: string;
  archived?: boolean;
}

export const giftCardCsvSchema: CsvSchema<GiftCardImportData> = {
  requiredFields: [
    {
      name: 'merchant',
      required: true,
      validator: validateRequiredString(200),
      description: 'Merchant name (max 200 characters)',
    },
    {
      name: 'card_number',
      required: true,
      validator: validateRequiredString(100),
      description: 'Card number or identifier (max 100 characters)',
    },
    {
      name: 'amount',
      required: true,
      validator: validateCurrency({ min: 0 }),
      description: 'Card balance (e.g. 50.00 or $50.00)',
    },
  ],
  optionalFields: [
    {
      name: 'pin',
      required: false,
      validator: validateOptionalString(50),
      description: 'Card PIN (max 50 characters)',
    },
    {
      name: 'notes',
      required: false,
      validator: validateOptionalString(2000),
      description: 'Additional notes (max 2000 characters)',
    },
    {
      name: 'archived',
      required: false,
      validator: validateBoolean(),
      defaultValue: false,
      description: 'true/false, yes/no, or 1/0 (default: false)',
    },
  ],
  labelFor: (raw) => (raw.merchant ? String(raw.merchant) : undefined),
};

/**
 * Starter CSV. Every example row lines up with the header — the previous
 * template's didn't, so anyone who filled it in got a file that wouldn't
 * import.
 */
export const template = () =>
  [
    'merchant,card_number,amount,pin,notes,archived',
    'Amazon,1234-5678-9012,100.00,4321,Birthday gift from Mom,false',
    'Starbucks,9876-5432,25.50,,"For daily coffee runs",false',
    'Target,4455-6677-8899-0011,50.00,,,false',
    '',
  ].join('\n');

export default createCsvParser(giftCardCsvSchema);
