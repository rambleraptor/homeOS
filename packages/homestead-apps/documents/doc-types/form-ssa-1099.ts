/**
 * Form SSA-1099 — Social Security benefit statement.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply.
 */

import type { DocType } from './docType';

const formSsa1099: DocType = {
  id: 'form-ssa-1099',
  label: 'Form SSA-1099',
  icon: () => import('lucide-react').then((m) => m.BadgeCheck),
  category: 'tax',
  description:
    'A US tax form reporting the Social Security benefits a person received during ' +
    'the year. Titled "Form SSA-1099" and "Social Security Benefit Statement", ' +
    'issued by the Social Security Administration.',
  fields: {
    beneficiary_name: {
      label: 'Beneficiary name',
      type: 'string',
      person: true,
      description: 'The person who received the benefits, as printed on the form.',
    },
    beneficiary_ssn: {
      label: "Beneficiary's SSN",
      type: 'string',
      description:
        "The beneficiary's Social Security number, often masked except for the last " +
        'four digits — record exactly what is printed.',
    },
    box_3_benefits_paid: {
      label: 'Box 3: Benefits paid',
      type: 'number',
      description: 'Total benefits paid during the year, from Box 3.',
    },
    box_4_benefits_repaid: {
      label: 'Box 4: Benefits repaid to SSA',
      type: 'number',
      description: 'Benefits repaid to the SSA during the year, from Box 4.',
    },
    box_5_net_benefits: {
      label: 'Box 5: Net benefits',
      type: 'number',
      description:
        'Net benefits for the year (Box 3 minus Box 4), from Box 5. The figure used ' +
        'on the tax return.',
    },
    box_6_voluntary_tax_withheld: {
      label: 'Box 6: Voluntary federal income tax withheld',
      type: 'number',
      description: 'Voluntary federal income tax withheld, from Box 6.',
    },
  },
};

export default formSsa1099;
