/**
 * A Closing Disclosure (or older HUD-1 settlement statement) from a home sale
 * or purchase.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply.
 *
 * Categorised as `tax` rather than `home` for the same reason the property tax
 * statement is: it is filed for what it proves at filing time. It establishes
 * the cost basis that decides the gain when the house is eventually sold —
 * which may be decades later, long after anyone remembers the numbers.
 */

import type { DocType } from './docType';

const closingDisclosure: DocType = {
  id: 'closing-disclosure',
  label: 'Closing Disclosure',
  icon: () => import('lucide-react').then((m) => m.FileSignature),
  category: 'tax',
  title_template: 'Closing Disclosure — {property_address}',
  description:
    'The settlement statement for a real estate purchase or sale. Titled ' +
    '"Closing Disclosure" (or "Settlement Statement" / "HUD-1" on older ' +
    'transactions), several pages long, itemising loan terms, closing costs, ' +
    'prepaid items, and cash to close. Distinct from Form 1099-S, which is a ' +
    'one-page numbered-box IRS form about the same transaction.',
  fields: {
    property_address: {
      label: 'Property address',
      type: 'string',
      description: 'The address of the property, from the top of page 1.',
    },
    closing_date: {
      label: 'Closing date',
      type: 'string',
      description: 'The closing or settlement date, from the top of page 1.',
    },
    borrower_name: {
      label: 'Borrower / buyer',
      type: 'string',
      person: true,
      description: 'The buyer or borrower, from the transaction information block.',
    },
    seller_name: {
      label: 'Seller',
      type: 'string',
      person: true,
      description:
        'The seller, from the transaction information block. Absent on a ' +
        'refinance, which has no seller.',
    },
    lender_name: {
      label: 'Lender',
      type: 'string',
      description: 'The lender making the loan. Absent on a cash purchase.',
    },
    sale_price: {
      label: 'Sale price',
      type: 'number',
      description: 'The sale price of the property, from the transaction information block.',
    },
    loan_amount: {
      label: 'Loan amount',
      type: 'number',
      description: 'The principal of the loan, from the loan terms table on page 1.',
    },
    // Named for Form 1098's Box 6 rather than for anything on this document,
    // which has no numbered boxes. Points are points: sharing the column means a
    // search for them finds the closing statement and the mortgage interest
    // form alike. The label is what a reader sees, and it drops the box number.
    box_6_points_paid: {
      label: 'Points paid',
      type: 'number',
      description:
        'Discount points paid to lower the interest rate, from the loan costs ' +
        'section — often labelled "% of Loan Amount (Points)". May be deductible.',
    },
    prepaid_property_tax: {
      label: 'Prepaid property tax',
      type: 'number',
      description:
        'Property taxes prepaid or reimbursed at closing, from the prepaids or ' +
        'adjustments section. Deductible by whoever bore them.',
    },
    total_closing_costs: {
      label: 'Total closing costs',
      type: 'number',
      description:
        'Total closing costs, from the costs at closing summary on page 1. Most ' +
        'are not deductible but do add to the property\'s cost basis.',
    },
    cash_to_close: {
      label: 'Cash to close',
      type: 'number',
      description:
        'The cash the buyer brought to closing, from the costs at closing ' +
        'summary. On a sale this may instead be cash *to* the seller.',
    },
  },
};

export default closingDisclosure;
