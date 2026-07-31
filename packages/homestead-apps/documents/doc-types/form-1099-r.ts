/**
 * Form 1099-R — distributions from pensions, annuities, and retirement plans.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply.
 */

import type { DocType } from './docType';

const form1099R: DocType = {
  id: 'form-1099-r',
  label: 'Form 1099-R',
  icon: () => import('lucide-react').then((m) => m.PiggyBank),
  category: 'tax',
  description:
    'A US tax form reporting distributions from a pension, annuity, IRA, or other ' +
    'retirement plan. Titled "Form 1099-R" and "Distributions From Pensions, ' +
    'Annuities, Retirement or Profit-Sharing Plans, IRAs, Insurance Contracts, etc."',
  fields: {
    payer_name: {
      label: 'Payer name',
      type: 'string',
      description: "The plan or custodian that made the distribution, from the PAYER'S block.",
    },
    payer_tin: {
      label: "Payer's TIN",
      type: 'string',
      description: "The payer's federal tax ID number, labelled PAYER'S TIN.",
    },
    recipient_name: {
      label: 'Recipient name',
      type: 'string',
      person: true,
      description: 'The person the distribution was paid to, as printed on the form.',
    },
    recipient_tin: {
      label: "Recipient's TIN",
      type: 'string',
      description:
        "The recipient's SSN or taxpayer ID, often masked except for the last four digits.",
    },
    box_1_gross_distribution: {
      label: 'Box 1: Gross distribution',
      type: 'number',
      description: 'The total amount distributed before withholding, from Box 1.',
    },
    box_2a_taxable_amount: {
      label: 'Box 2a: Taxable amount',
      type: 'number',
      description:
        'The taxable portion of the distribution, from Box 2a. Often equals Box 1, ' +
        'but not always — do not assume.',
    },
    box_4_federal_tax_withheld: {
      label: 'Box 4: Federal income tax withheld',
      type: 'number',
      description: 'Federal income tax withheld from the distribution, from Box 4.',
    },
    box_7_distribution_code: {
      label: 'Box 7: Distribution code(s)',
      type: 'string',
      description:
        'The code(s) describing the distribution type, from Box 7 (e.g. "7", "1", ' +
        '"G"). Record exactly as printed, including any letter.',
    },
    account_number: {
      label: 'Account number',
      type: 'string',
      description: 'The plan or account number the distribution came from, if shown.',
    },
  },
};

export default form1099R;
