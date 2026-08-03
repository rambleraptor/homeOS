/**
 * Form 1099-MISC — miscellaneous information.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Note this
 * is distinct from Form 1099-NEC, which took over nonemployee compensation.
 */

import type { DocType } from './docType';

const form1099Misc: DocType = {
  id: 'form-1099-misc',
  label: 'Form 1099-MISC',
  icon: () => import('lucide-react').then((m) => m.FileText),
  category: 'tax',
  title_template: '1099-MISC ({tax_year}) — {payer_name}',
  description:
    'A US tax form reporting miscellaneous income such as rents, royalties, and ' +
    'prizes. Titled "Form 1099-MISC" and "Miscellaneous Information", with numbered ' +
    'boxes (1-18). Distinct from Form 1099-NEC, which reports nonemployee pay.',
  fields: {
    payer_name: {
      label: 'Payer name',
      type: 'string',
      description: "The person or business that made the payments, from the PAYER'S block.",
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
      description: 'The person or business paid, as printed on the form.',
    },
    recipient_tin: {
      label: "Recipient's TIN",
      type: 'string',
      description:
        "The recipient's SSN or taxpayer ID, often masked except for the last four digits.",
    },
    box_1_rents: {
      label: 'Box 1: Rents',
      type: 'number',
      description: 'Rents paid during the year, from Box 1.',
    },
    box_2_royalties: {
      label: 'Box 2: Royalties',
      type: 'number',
      description: 'Royalty payments, from Box 2.',
    },
    box_3_other_income: {
      label: 'Box 3: Other income',
      type: 'number',
      description: 'Other income such as prizes and awards, from Box 3.',
    },
    box_4_federal_tax_withheld: {
      label: 'Box 4: Federal income tax withheld',
      type: 'number',
      description: 'Federal income tax withheld, from Box 4. Usually backup withholding.',
    },
    box_6_medical_payments: {
      label: 'Box 6: Medical and health care payments',
      type: 'number',
      description: 'Medical and health-care payments, from Box 6.',
    },
  },
};

export default form1099Misc;
