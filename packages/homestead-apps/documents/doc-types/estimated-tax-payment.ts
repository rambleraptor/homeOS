/**
 * A record of an estimated tax payment (Form 1040-ES).
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply.
 *
 * The one tax document nobody sends you: a quarterly payment leaves a
 * confirmation page, a bank record, or a stamped voucher, and if it isn't kept
 * there is nothing at filing time to prove the money went. Covers state
 * estimated payments too, which is why the authority is a field rather than
 * assumed to be the IRS.
 */

import type { DocType } from './docType';

const estimatedTaxPayment: DocType = {
  id: 'estimated-tax-payment',
  label: 'Estimated tax payment',
  icon: () => import('lucide-react').then((m) => m.CalendarClock),
  category: 'tax',
  title_template: 'Estimated tax ({tax_year} {quarter}) — {taxing_authority}',
  description:
    'A record of a quarterly estimated tax payment: an IRS Direct Pay or EFTPS ' +
    'confirmation, a bank or card receipt for a tax payment, or a completed Form ' +
    '1040-ES payment voucher. Shows an amount paid toward a tax year that has ' +
    'not been filed yet. Not a bill, and not a refund.',
  fields: {
    taxpayer_name: {
      label: 'Taxpayer',
      type: 'string',
      person: true,
      description: 'The person the payment was made for, if named.',
    },
    taxing_authority: {
      label: 'Paid to',
      type: 'string',
      description:
        'Who was paid — "IRS" for a federal payment, otherwise the state revenue ' +
        'department (e.g. "California Franchise Tax Board").',
    },
    payment_date: {
      label: 'Payment date',
      type: 'string',
      description: 'The date the payment was made or settled.',
    },
    payment_amount: {
      label: 'Amount paid',
      type: 'number',
      description: 'The amount paid. A plain number, no currency symbol.',
    },
    quarter: {
      label: 'Quarter',
      type: 'string',
      description:
        'Which instalment this is, as Q1, Q2, Q3, or Q4. Estimated payments are ' +
        'due in April, June, September, and the following January — infer from ' +
        'the payment date when the record does not say.',
    },
    confirmation_number: {
      label: 'Confirmation number',
      type: 'string',
      description:
        'The payment confirmation or reference number, which is what identifies ' +
        'the payment if it later has to be traced.',
    },
    tax_year: {
      label: 'Tax year',
      type: 'number',
      description:
        'The tax year the payment is *for*, as a four-digit year — not the year ' +
        'it was made. A Q4 instalment is paid in January of the following year, ' +
        'and a payment page usually states the year it is applied to.',
    },
  },
};

export default estimatedTaxPayment;
