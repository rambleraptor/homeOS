/**
 * Form W-2 — wage and tax statement.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply.
 */

import type { DocType } from './docType';

const formW2: DocType = {
  id: 'form-w2',
  label: 'Form W-2',
  icon: () => import('lucide-react').then((m) => m.BadgeDollarSign),
  description:
    'A US tax form reporting wages paid by an employer and taxes withheld during ' +
    'the year. Titled "Form W-2" and "Wage and Tax Statement", laid out in ' +
    'lettered boxes (a-f) down the left and numbered boxes (1-20) on the right.',
  fields: {
    employer_name: {
      label: 'Employer name',
      type: 'string',
      description:
        "The employer that paid the wages, from Box c (Employer's name, address, " +
        'and ZIP code). Take the name only, not the address.',
    },
    employer_ein: {
      label: "Employer's EIN",
      type: 'string',
      description:
        "The employer's federal Employer Identification Number, from Box b.",
    },
    employee_name: {
      label: 'Employee name',
      type: 'string',
      description: 'The employee the wages were paid to, from Box e.',
    },
    employee_ssn: {
      label: "Employee's SSN",
      type: 'string',
      description:
        "The employee's Social Security number, from Box a. Often masked except " +
        'for the last four digits — record exactly what is printed, masking included.',
    },
    box_1_wages: {
      label: 'Box 1: Wages, tips, other compensation',
      type: 'number',
      description:
        'Total taxable wages for federal income tax, from Box 1. Frequently ' +
        'differs from Box 3 and Box 5; do not substitute one for another.',
    },
    box_2_federal_tax_withheld: {
      label: 'Box 2: Federal income tax withheld',
      type: 'number',
      description: 'Federal income tax withheld from pay, from Box 2.',
    },
    box_3_social_security_wages: {
      label: 'Box 3: Social Security wages',
      type: 'number',
      description:
        'Wages subject to Social Security tax, from Box 3. Capped annually, so ' +
        'this is often lower than Box 1.',
    },
    box_4_social_security_tax_withheld: {
      label: 'Box 4: Social Security tax withheld',
      type: 'number',
      description: 'Social Security tax withheld, from Box 4.',
    },
    box_5_medicare_wages: {
      label: 'Box 5: Medicare wages and tips',
      type: 'number',
      description:
        'Wages subject to Medicare tax, from Box 5. Uncapped, so this is often ' +
        'the largest of the wage boxes.',
    },
    box_6_medicare_tax_withheld: {
      label: 'Box 6: Medicare tax withheld',
      type: 'number',
      description: 'Medicare tax withheld, from Box 6.',
    },
  },
};

export default formW2;
