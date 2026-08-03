/**
 * Form 1099-G — certain government payments.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply.
 */

import type { DocType } from './docType';

const form1099G: DocType = {
  id: 'form-1099-g',
  label: 'Form 1099-G',
  icon: () => import('lucide-react').then((m) => m.Building2),
  category: 'tax',
  title_template: '1099-G ({tax_year}) — {payer_name}',
  description:
    'A US tax form reporting government payments such as unemployment compensation ' +
    'and state or local tax refunds. Titled "Form 1099-G" and "Certain Government ' +
    'Payments", issued by a state or federal agency.',
  fields: {
    payer_name: {
      label: 'Payer name',
      type: 'string',
      description: "The government agency that made the payment, from the PAYER'S block.",
    },
    payer_tin: {
      label: "Payer's TIN",
      type: 'string',
      description: "The agency's federal tax ID number, labelled PAYER'S TIN.",
    },
    recipient_name: {
      label: 'Recipient name',
      type: 'string',
      person: true,
      description: 'The person the payment was made to, as printed on the form.',
    },
    recipient_tin: {
      label: "Recipient's TIN",
      type: 'string',
      description:
        "The recipient's SSN or taxpayer ID, often masked except for the last four digits.",
    },
    box_1_unemployment_compensation: {
      label: 'Box 1: Unemployment compensation',
      type: 'number',
      description: 'Unemployment compensation paid during the year, from Box 1.',
    },
    box_2_state_local_refunds: {
      label: 'Box 2: State or local income tax refunds',
      type: 'number',
      description:
        'State or local income tax refunds, credits, or offsets, from Box 2. May be ' +
        'taxable if you itemized in the prior year.',
    },
    box_4_federal_tax_withheld: {
      label: 'Box 4: Federal income tax withheld',
      type: 'number',
      description: 'Federal income tax withheld, from Box 4.',
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

export default form1099G;
