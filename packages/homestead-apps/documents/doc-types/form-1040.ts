/**
 * Form 1040 — the filed US individual income tax return itself.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply.
 *
 * Every other tax type here is an *input* to a return; this is the return. Worth
 * keeping because next year's filing needs it: the prior-year AGI authenticates
 * an e-file, and carryforwards (capital losses, charitable deductions) are read
 * off it rather than recomputed.
 */

import type { DocType } from './docType';

const form1040: DocType = {
  id: 'form-1040',
  label: 'Form 1040',
  icon: () => import('lucide-react').then((m) => m.FileSpreadsheet),
  category: 'tax',
  title_template: 'Form 1040 ({tax_year}) — {taxpayer_name}',
  description:
    'A filed US individual income tax return. Titled "Form 1040" and "U.S. ' +
    'Individual Income Tax Return", with numbered lines running down two pages ' +
    'and often followed by schedules. This is the completed return, not one of ' +
    'the statements that feed it. Variants 1040-SR (seniors) and 1040-X ' +
    '(amended) count as the same type.',
  fields: {
    taxpayer_name: {
      label: 'Taxpayer name',
      type: 'string',
      person: true,
      description: 'The primary filer, from the name block at the top of page 1.',
    },
    spouse_name: {
      label: 'Spouse name',
      type: 'string',
      person: true,
      description:
        "The spouse's name, from the name block, when the return is a joint one. " +
        'Absent otherwise.',
    },
    filing_status: {
      label: 'Filing status',
      type: 'string',
      description:
        'The status ticked at the top of page 1 — Single, Married filing ' +
        'jointly, Married filing separately, Head of household, or Qualifying ' +
        'surviving spouse.',
    },
    adjusted_gross_income: {
      label: 'Adjusted gross income',
      type: 'number',
      description:
        'AGI, from line 11. The figure next year\'s e-file asks for to verify ' +
        'identity. Distinct from taxable income, which is lower.',
    },
    taxable_income: {
      label: 'Taxable income',
      type: 'number',
      description:
        'Taxable income, from line 15 — AGI less the standard or itemized ' +
        'deduction.',
    },
    total_tax: {
      label: 'Total tax',
      type: 'number',
      description:
        'Total tax owed for the year, from line 24. What the return computes, ' +
        'before comparing it to what was already paid.',
    },
    total_payments: {
      label: 'Total payments',
      type: 'number',
      description:
        'Everything already paid in — withholding plus estimated payments and ' +
        'refundable credits, from line 33.',
    },
    refund_amount: {
      label: 'Refund',
      type: 'number',
      description:
        'The refund due, from line 34 or 35a. Present only when payments exceeded ' +
        'the tax.',
    },
    amount_owed: {
      label: 'Amount owed',
      type: 'number',
      description:
        'The balance still owed, from line 37. Present only when the tax exceeded ' +
        'payments. A return has one of this and the refund, never both.',
    },
    tax_year: {
      label: 'Tax year',
      type: 'number',
      description:
        'The tax year the return is for, as a four-digit year (e.g. 2024). ' +
        'Printed beside the form title at the top of page 1.',
    },
  },
};

export default form1040;
