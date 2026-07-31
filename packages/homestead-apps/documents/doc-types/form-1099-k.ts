/**
 * Form 1099-K — payment card and third party network transactions.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. This form
 * names a FILER (the payment settlement entity) and a PAYEE, not payer/recipient.
 */

import type { DocType } from './docType';

const form1099K: DocType = {
  id: 'form-1099-k',
  label: 'Form 1099-K',
  icon: () => import('lucide-react').then((m) => m.CreditCard),
  category: 'tax',
  description:
    'A US tax form reporting payments settled through a card processor or ' +
    'third-party network (e.g. a marketplace or payment app). Titled "Form 1099-K" ' +
    'and "Payment Card and Third Party Network Transactions".',
  fields: {
    filer_name: {
      label: 'Filer name',
      type: 'string',
      description:
        "The payment settlement entity that filed the form, from the FILER'S name " +
        'block (e.g. the card processor or marketplace).',
    },
    filer_tin: {
      label: "Filer's TIN",
      type: 'string',
      description: "The filer's federal tax ID number, labelled FILER'S TIN.",
    },
    payee_name: {
      label: 'Payee name',
      type: 'string',
      person: true,
      description: 'The payee the payments were settled to, as printed on the form.',
    },
    payee_tin: {
      label: "Payee's TIN",
      type: 'string',
      description:
        "The payee's SSN or taxpayer ID, often masked except for the last four digits.",
    },
    box_1a_gross_amount: {
      label: 'Box 1a: Gross amount of transactions',
      type: 'number',
      description:
        'Gross amount of all reportable payment transactions, from Box 1a. Before ' +
        'any fees or refunds.',
    },
    box_1b_card_not_present: {
      label: 'Box 1b: Card not present transactions',
      type: 'number',
      description: 'The card-not-present portion of Box 1a, from Box 1b.',
    },
    number_of_transactions: {
      label: 'Box 3: Number of payment transactions',
      type: 'number',
      description: 'The count of payment transactions, from Box 3.',
    },
    box_4_federal_tax_withheld: {
      label: 'Box 4: Federal income tax withheld',
      type: 'number',
      description: 'Federal income tax withheld, from Box 4. Usually zero.',
    },
  },
};

export default form1099K;
