/**
 * Form 5498-SA — HSA, Archer MSA, or Medicare Advantage MSA information.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply.
 */

import type { DocType } from './docType';

const form5498Sa: DocType = {
  id: 'form-5498-sa',
  label: 'Form 5498-SA',
  icon: () => import('lucide-react').then((m) => m.Wallet),
  category: 'tax',
  title_template: '5498-SA ({tax_year}) — {trustee_name}',
  description:
    'A US tax form reporting contributions to a health savings account during the ' +
    'year, plus its year-end value. Titled "Form 5498-SA" and "HSA, Archer MSA, or ' +
    'Medicare Advantage MSA Information". Distinct from Form 5498 (IRA).',
  fields: {
    trustee_name: {
      label: 'Trustee name',
      type: 'string',
      description: "The HSA/MSA trustee or custodian, from the TRUSTEE'S name block.",
    },
    trustee_tin: {
      label: "Trustee's TIN",
      type: 'string',
      description: "The trustee's federal tax ID number.",
    },
    participant_name: {
      label: 'Participant name',
      type: 'string',
      person: true,
      description: 'The account holder (participant), as printed on the form.',
    },
    participant_tin: {
      label: "Participant's TIN",
      type: 'string',
      description:
        "The participant's SSN or taxpayer ID, often masked except for the last four digits.",
    },
    box_2_total_contributions: {
      label: 'Box 2: Total contributions made this year',
      type: 'number',
      description: 'Total HSA/MSA contributions made during the year, from Box 2.',
    },
    box_3_total_contributions_current_year: {
      label: 'Box 3: Total contributions for the current year',
      type: 'number',
      description:
        'Total contributions made this year for the current tax year (including ' +
        'those made by the filing deadline), from Box 3.',
    },
    box_5_fair_market_value: {
      label: 'Box 5: Fair market value of account',
      type: 'number',
      description: 'The account\'s fair market value at year end, from Box 5.',
    },
  },
};

export default form5498Sa;
