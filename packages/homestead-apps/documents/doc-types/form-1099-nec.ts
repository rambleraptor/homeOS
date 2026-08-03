/**
 * Form 1099-NEC — nonemployee compensation.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply.
 */

import type { DocType } from './docType';

const form1099Nec: DocType = {
  id: 'form-1099-nec',
  label: 'Form 1099-NEC',
  icon: () => import('lucide-react').then((m) => m.Briefcase),
  category: 'tax',
  title_template: '1099-NEC ({tax_year}) — {payer_name}',
  description:
    'A US tax form reporting pay to an independent contractor or freelancer. ' +
    'Titled "Form 1099-NEC" and "Nonemployee Compensation", with a prominent Box 1. ' +
    'Issued to self-employed people, not employees (who get a W-2).',
  fields: {
    payer_name: {
      label: 'Payer name',
      type: 'string',
      description: "The business that paid the contractor, from the PAYER'S name block.",
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
      description: 'The contractor the pay went to, as printed on the form.',
    },
    recipient_tin: {
      label: "Recipient's TIN",
      type: 'string',
      description:
        "The recipient's SSN or taxpayer ID, often masked except for the last four digits.",
    },
    box_1_nonemployee_compensation: {
      label: 'Box 1: Nonemployee compensation',
      type: 'number',
      description: 'Total nonemployee compensation paid during the year, from Box 1.',
    },
    box_4_federal_tax_withheld: {
      label: 'Box 4: Federal income tax withheld',
      type: 'number',
      description: 'Federal income tax withheld, from Box 4. Usually zero.',
    },
    state_tax_withheld: {
      label: 'Box 5: State tax withheld',
      type: 'number',
      description: 'State income tax withheld, from Box 5, if any.',
    },
  },
};

export default form1099Nec;
