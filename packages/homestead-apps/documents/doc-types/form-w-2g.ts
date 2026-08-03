/**
 * Form W-2G — certain gambling winnings.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Distinct
 * from Form W-2 (wages) despite the similar name.
 */

import type { DocType } from './docType';

const formW2G: DocType = {
  id: 'form-w-2g',
  label: 'Form W-2G',
  icon: () => import('lucide-react').then((m) => m.Dices),
  category: 'tax',
  title_template: 'W-2G ({tax_year}) — {payer_name}',
  description:
    'A US tax form reporting gambling winnings and any tax withheld. Titled "Form ' +
    'W-2G" and "Certain Gambling Winnings", issued by a casino, lottery, or track. ' +
    'Distinct from Form W-2 (employee wages).',
  fields: {
    payer_name: {
      label: 'Payer name',
      type: 'string',
      description: "The casino, lottery, or payer that reported the winnings, from the PAYER'S block.",
    },
    payer_tin: {
      label: "Payer's TIN",
      type: 'string',
      description: "The payer's federal tax ID number.",
    },
    winner_name: {
      label: 'Winner name',
      type: 'string',
      person: true,
      description: 'The winner the payment was made to, as printed on the form.',
    },
    winner_tin: {
      label: "Winner's TIN",
      type: 'string',
      description:
        "The winner's SSN or taxpayer ID, often masked except for the last four digits.",
    },
    box_1_reportable_winnings: {
      label: 'Box 1: Reportable winnings',
      type: 'number',
      description: 'The gross reportable winnings, from Box 1.',
    },
    box_2_date_won: {
      label: 'Box 2: Date won',
      type: 'string',
      description: 'The date of the winning event, from Box 2. As printed.',
    },
    box_4_federal_tax_withheld: {
      label: 'Box 4: Federal income tax withheld',
      type: 'number',
      description: 'Federal income tax withheld from the winnings, from Box 4.',
    },
    type_of_wager: {
      label: 'Box 3: Type of wager',
      type: 'string',
      description: 'The kind of bet or game (e.g. "slot machine", "lottery"), from Box 3.',
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

export default formW2G;
