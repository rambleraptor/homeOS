/**
 * A childcare provider's year-end statement of what was paid.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply.
 *
 * Claiming the child and dependent care credit needs the provider's taxpayer ID
 * on Form 2441, and a daycare's year-end letter is where that number lives. It
 * is asked for once a year and remembered by nobody, which is exactly the kind
 * of thing worth extracting.
 */

import type { DocType } from './docType';

const childcareProviderStatement: DocType = {
  id: 'childcare-provider-statement',
  label: 'Childcare provider statement',
  icon: () => import('lucide-react').then((m) => m.Baby),
  category: 'tax',
  title_template: 'Childcare ({tax_year}) — {provider_name}',
  description:
    'A year-end statement from a daycare, preschool, after-school programme, or ' +
    'in-home carer, showing what a family paid over the year. Usually a letter ' +
    'or printed summary naming the children, the total paid, and the provider\'s ' +
    'tax ID — the details Form 2441 asks for. Not an invoice for a single month.',
  fields: {
    provider_name: {
      label: 'Provider',
      type: 'string',
      description: 'The childcare provider or centre that issued the statement.',
    },
    provider_tin: {
      label: "Provider's TIN",
      type: 'string',
      description:
        "The provider's EIN, or SSN for an individual carer. The number Form 2441 " +
        'requires; record it exactly as printed.',
    },
    provider_address: {
      label: "Provider's address",
      type: 'string',
      description: "The provider's address, also required on Form 2441.",
    },
    children: {
      label: 'Children',
      type: 'array',
      description: 'The children the care was for. Names only, one per entry.',
      items: {
        label: 'Child',
        type: 'string',
        person: true,
        description: "A child's name as printed on the statement.",
      },
    },
    amount_paid: {
      label: 'Total paid',
      type: 'number',
      description:
        'The total paid to the provider over the year. Take the annual total, ' +
        'not a weekly or monthly rate. A plain number, no currency symbol.',
    },
    tax_year: {
      label: 'Tax year',
      type: 'number',
      description:
        'The tax year the statement covers, as a four-digit year (e.g. 2024).',
    },
  },
};

export default childcareProviderStatement;
