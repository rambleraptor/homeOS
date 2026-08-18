/**
 * Form 1099-S — proceeds from a real estate transaction.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply.
 *
 * Shares `property_address` with Form 1098 and `filer_name`/`filer_tin` with the
 * other filer-issued forms: the same fact in the same column, whichever form it
 * arrived on.
 */

import type { DocType } from './docType';

const form1099S: DocType = {
  id: 'form-1099-s',
  label: 'Form 1099-S',
  icon: () => import('lucide-react').then((m) => m.MapPinHouse),
  category: 'tax',
  title_template: '1099-S ({tax_year}) — {property_address}',
  description:
    'A US tax form reporting the gross proceeds from a sale or exchange of real ' +
    'estate. Titled "Form 1099-S" and "Proceeds From Real Estate Transactions". ' +
    'Issued by the closing or settlement agent to the seller, usually at closing ' +
    'rather than in January. Not the same as the Closing Disclosure, which is a ' +
    'multi-page settlement statement rather than a numbered-box IRS form.',
  fields: {
    filer_name: {
      label: 'Filer name',
      type: 'string',
      description:
        'The settlement agent, title company, or closing attorney that issued the ' +
        "form, from the FILER'S name block, top left.",
    },
    filer_tin: {
      label: "Filer's TIN",
      type: 'string',
      description: "The filer's federal tax ID number, labelled FILER'S TIN.",
    },
    transferor_name: {
      label: 'Transferor name',
      type: 'string',
      person: true,
      description:
        "The seller of the property, from the TRANSFEROR'S name block. The person " +
        'who received the proceeds.',
    },
    transferor_tin: {
      label: "Transferor's TIN",
      type: 'string',
      description:
        "The seller's SSN or taxpayer ID. Often masked except for the last four " +
        'digits — record exactly what is printed, masking included.',
    },
    property_address: {
      label: 'Property address',
      type: 'string',
      description:
        'The address or legal description of the property transferred, from Box 3.',
    },
    box_1_date_of_closing: {
      label: 'Box 1: Date of closing',
      type: 'string',
      description: 'The closing date of the transaction, from Box 1.',
    },
    box_2_gross_proceeds: {
      label: 'Box 2: Gross proceeds',
      type: 'number',
      description:
        'The gross proceeds from the sale, from Box 2. The sale price before ' +
        'selling costs and before any mortgage payoff — not the seller\'s net ' +
        'cash. A plain number, no currency symbol.',
    },
    box_5_buyers_part_of_real_estate_tax: {
      label: "Box 5: Buyer's part of real estate tax",
      type: 'number',
      description:
        'The portion of real estate tax charged to the buyer, from Box 5. Present ' +
        'only when the seller had prepaid the tax.',
    },
    tax_year: {
      label: 'Tax year',
      type: 'number',
      description:
        'The tax year this form reports, as a four-digit year (e.g. 2024). ' +
        'Usually printed near the form title (often as "For calendar year ' +
        'YYYY") or in a corner of the form.',
    },
  },
};

export default form1099S;
