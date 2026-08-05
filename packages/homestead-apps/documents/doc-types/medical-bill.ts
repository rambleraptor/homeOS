/**
 * Medical bill — the invoice a provider (doctor, hospital, clinic, lab) sends
 * for services rendered, showing what is owed and by when.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Every
 * `description` is handed to the model verbatim, so they say where a value sits
 * on the statement and how to keep a bill distinct from its neighbours.
 *
 * The key distinctions: a medical bill asks for payment (it has a balance due
 * and often a due date), unlike an Explanation of Benefits, which explains a
 * claim and says "this is not a bill". Unlike a `medical-receipt`, a bill is
 * unpaid — a receipt records a purchase already paid. `provider`,
 * `patient`, `service_date`, and `amount_billed` are shared with the EOB type on
 * purpose, so they share one metadata column and one filter facet.
 */

import type { DocType } from './docType';

const medicalBill: DocType = {
  id: 'medical-bill',
  label: 'Medical bill',
  icon: () => import('lucide-react').then((m) => m.Receipt),
  category: 'medical',
  title_template: 'Medical Bill — {provider}',
  description:
    'A bill or invoice from a healthcare provider — a doctor\'s office, ' +
    'hospital, clinic, lab, dentist, or similar — requesting payment for ' +
    'services. Shows the provider, the patient, an account or statement number, ' +
    'the charges, a balance due, and usually a payment due date. Use this type ' +
    'for a provider\'s statement asking for payment; do not use it for an ' +
    'insurer\'s Explanation of Benefits (which explains a claim and is not a ' +
    'bill) or for a receipt of an expense already paid.',
  fields: {
    provider: {
      label: 'Provider',
      type: 'string',
      description:
        'The healthcare provider or facility that issued the bill — the ' +
        'doctor\'s office, hospital, clinic, or lab. The business name only, ' +
        'usually at the top; not a billing service or collections agency name.',
    },
    patient: {
      label: 'Patient',
      type: 'string',
      person: true,
      description:
        'The person who received the care, as named on the bill — the patient, ' +
        'not the guarantor or account holder responsible for payment if they ' +
        'differ.',
    },
    account_number: {
      label: 'Account number',
      type: 'string',
      description:
        'The provider\'s account or statement number for this bill, used as a ' +
        'reference when paying. Labelled "Account No.", "Statement ID", or ' +
        'similar. Record it exactly as printed.',
    },
    service_date: {
      label: 'Date of service',
      type: 'string',
      description:
        'The date the care was provided (the "date of service"), not the ' +
        'statement or due date. Prefer an ISO date (YYYY-MM-DD) when the parts ' +
        'are unambiguous; otherwise record it exactly as shown. If several ' +
        'service lines span dates, take the earliest.',
    },
    amount_billed: {
      label: 'Total charges',
      type: 'number',
      description:
        'The total amount charged for the services on this bill, before any ' +
        'payments or adjustments. A plain number, no currency symbol.',
    },
    amount_due: {
      label: 'Amount due',
      type: 'number',
      description:
        'The balance the patient is asked to pay now — the "amount due", ' +
        '"balance", or "please pay this amount" figure, after any insurance ' +
        'payment and prior payments. A plain number, no currency symbol.',
    },
    due_date: {
      label: 'Due date',
      type: 'string',
      description:
        'The date payment is due, when the bill states one. Prefer an ISO date ' +
        '(YYYY-MM-DD) when unambiguous; otherwise record it exactly as shown. ' +
        'Leave blank if no due date is printed.',
    },
  },
};

export default medicalBill;
