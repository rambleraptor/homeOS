/**
 * Form 1095-A — health insurance marketplace statement.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply.
 */

import type { DocType } from './docType';

const form1095A: DocType = {
  id: 'form-1095-a',
  label: 'Form 1095-A',
  icon: () => import('lucide-react').then((m) => m.ShieldPlus),
  category: 'tax',
  description:
    'A US tax form reporting health coverage bought through the Health Insurance ' +
    'Marketplace, used to reconcile the premium tax credit on Form 8962. Titled ' +
    '"Form 1095-A" and "Health Insurance Marketplace Statement".',
  fields: {
    recipient_name: {
      label: 'Recipient name',
      type: 'string',
      person: true,
      description: 'The Marketplace recipient (policyholder), from Part I, as printed.',
    },
    recipient_ssn: {
      label: "Recipient's SSN",
      type: 'string',
      description:
        "The recipient's SSN, often masked except for the last four digits — record " +
        'exactly what is printed.',
    },
    policy_number: {
      label: 'Marketplace-assigned policy number',
      type: 'string',
      description: 'The Marketplace-assigned policy number, from Part I.',
    },
    insurance_company_name: {
      label: 'Insurance company name',
      type: 'string',
      description: 'The insurance company that issued the policy, from Part I.',
    },
    annual_premium: {
      label: 'Annual premium amount',
      type: 'number',
      description:
        'The total annual premium, from the Part III annual total (column A). Sum of ' +
        'the monthly premium amounts.',
    },
    annual_slcsp_premium: {
      label: 'Annual SLCSP premium',
      type: 'number',
      description:
        "The annual second lowest cost silver plan premium, from Part III's annual " +
        'total (column B). Used to compute the premium tax credit.',
    },
    annual_advance_premium_tax_credit: {
      label: 'Annual advance payment of premium tax credit',
      type: 'number',
      description:
        'The annual advance payment of the premium tax credit, from the Part III ' +
        'annual total (column C).',
    },
  },
};

export default form1095A;
