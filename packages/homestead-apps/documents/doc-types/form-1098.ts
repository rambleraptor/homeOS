/**
 * Form 1098 — mortgage interest statement.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. This form
 * names a LENDER/RECIPIENT and a BORROWER/PAYER.
 */

import type { DocType } from './docType';

const form1098: DocType = {
  id: 'form-1098',
  label: 'Form 1098',
  icon: () => import('lucide-react').then((m) => m.House),
  category: 'tax',
  title_template: '1098 ({tax_year}) — {lender_name}',
  description:
    'A US tax form reporting mortgage interest a homeowner paid during the year. ' +
    'Titled "Form 1098" and "Mortgage Interest Statement", issued by the mortgage ' +
    'lender or servicer. Distinct from Form 1098-E (student loans) and 1098-T (tuition).',
  fields: {
    lender_name: {
      label: 'Lender name',
      type: 'string',
      description:
        "The mortgage lender or servicer that received the interest, from the " +
        "RECIPIENT'S/LENDER'S name block.",
    },
    lender_tin: {
      label: "Lender's TIN",
      type: 'string',
      description: "The lender's federal tax ID number, labelled RECIPIENT'S/LENDER'S TIN.",
    },
    borrower_name: {
      label: 'Borrower name',
      type: 'string',
      person: true,
      description: 'The homeowner who paid the interest, from the PAYER/BORROWER block.',
    },
    borrower_tin: {
      label: "Borrower's TIN",
      type: 'string',
      description:
        "The borrower's SSN or taxpayer ID, often masked except for the last four digits.",
    },
    box_1_mortgage_interest: {
      label: 'Box 1: Mortgage interest received',
      type: 'number',
      description: 'Mortgage interest received from the borrower during the year, from Box 1.',
    },
    box_2_outstanding_principal: {
      label: 'Box 2: Outstanding mortgage principal',
      type: 'number',
      description: 'The outstanding principal as of the start of the year, from Box 2.',
    },
    box_5_mortgage_insurance_premiums: {
      label: 'Box 5: Mortgage insurance premiums',
      type: 'number',
      description: 'Mortgage insurance premiums paid, from Box 5.',
    },
    box_6_points_paid: {
      label: 'Box 6: Points paid on purchase',
      type: 'number',
      description: 'Points paid on the purchase of a principal residence, from Box 6.',
    },
    property_address: {
      label: 'Property address',
      type: 'string',
      description: 'The address of the property securing the mortgage, if shown.',
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

export default form1098;
