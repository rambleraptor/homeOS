/**
 * Form 1099-SA — distributions from an HSA, Archer MSA, or Medicare Advantage MSA.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply.
 */

import type { DocType } from './docType';

const form1099Sa: DocType = {
  id: 'form-1099-sa',
  label: 'Form 1099-SA',
  icon: () => import('lucide-react').then((m) => m.HeartPulse),
  category: 'tax',
  description:
    'A US tax form reporting distributions from a health savings account (HSA) or ' +
    'medical savings account. Titled "Form 1099-SA" and "Distributions From an HSA, ' +
    'Archer MSA, or Medicare Advantage MSA".',
  fields: {
    payer_name: {
      label: 'Payer name',
      type: 'string',
      description: "The HSA/MSA custodian or trustee, from the PAYER'S name block.",
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
      description: 'The account holder the distribution was paid to, as printed on the form.',
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
      description: 'The total distributed from the account during the year, from Box 1.',
    },
    box_2_earnings_on_excess: {
      label: 'Box 2: Earnings on excess contributions',
      type: 'number',
      description: 'Earnings on excess contributions distributed, from Box 2.',
    },
    box_3_distribution_code: {
      label: 'Box 3: Distribution code',
      type: 'string',
      description:
        'The single-digit code describing the distribution, from Box 3 (e.g. "1" for ' +
        'normal). Record exactly as printed.',
    },
    account_number: {
      label: 'Account number',
      type: 'string',
      description: 'The HSA/MSA account number, if shown.',
    },
  },
};

export default form1099Sa;
