/**
 * Explanation of Benefits (EOB) — the statement a health insurer sends after
 * processing a claim, reconciling what the provider billed, what the plan paid,
 * and what the patient owes.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Every
 * `description` is handed to the model verbatim, so they name where a value sits
 * on the statement and how to tell an EOB apart from the bill it explains.
 *
 * The single most important distinction the model must make: an EOB is *not* a
 * bill. It usually says so in bold ("This is not a bill"); the provider sends a
 * separate bill for the patient-responsibility amount (the `medical-bill` type).
 * `carrier`, `service_date`, and `amount_billed` are shared with the other
 * medical and insurance types on purpose, so they share one metadata column and
 * one filter facet.
 */

import type { DocType } from './docType';

const explanationOfBenefits: DocType = {
  id: 'explanation-of-benefits',
  label: 'Explanation of Benefits',
  icon: () => import('lucide-react').then((m) => m.ReceiptText),
  category: 'medical',
  title_template: 'Explanation of Benefits — {carrier}',
  description:
    'An Explanation of Benefits (EOB) — a statement a health insurance company ' +
    'sends a member after it processes a claim. It reconciles what the provider ' +
    'billed, the allowed (negotiated) amount, what the plan paid, and the ' +
    'patient responsibility (copay, coinsurance, and anything applied to the ' +
    'deductible). Almost always marked "This is not a bill" — the provider ' +
    'sends a separate bill for the amount owed. Use this type for an insurer\'s ' +
    'benefits statement; do not use it for the provider\'s actual bill or ' +
    'invoice (that is a medical bill), nor for a paid pharmacy/clinic receipt.',
  fields: {
    carrier: {
      label: 'Carrier',
      type: 'string',
      description:
        'The insurance company that issued the EOB and processed the claim ' +
        '(e.g. "Aetna", "Blue Cross Blue Shield", "UnitedHealthcare"). The ' +
        'insurer\'s name only, not the employer plan sponsor or the provider.',
    },
    claim_number: {
      label: 'Claim number',
      type: 'string',
      description:
        'The insurer\'s identifier for this claim, used to reference it on ' +
        'appeals or calls. Labelled "Claim Number" or "Claim ID". Record it ' +
        'exactly as printed; not the member/subscriber id.',
    },
    service_date: {
      label: 'Service date',
      type: 'string',
      description:
        'The date the care was provided (the "date of service"), often ' +
        'different from the date the EOB was issued or mailed. Prefer an ISO ' +
        'date (YYYY-MM-DD) when the parts are unambiguous; otherwise record it ' +
        'exactly as shown. If several service lines span dates, take the earliest.',
    },
    amount_billed: {
      label: 'Total billed',
      type: 'number',
      description:
        'What the provider charged for the service before any insurer ' +
        'adjustment — the "billed"/"charged"/"provider charges" total across ' +
        'service lines. A plain number, no currency symbol.',
    },
    plan_paid: {
      label: 'Plan paid',
      type: 'number',
      description:
        'The amount the insurance plan paid the provider — the "plan paid" or ' +
        '"amount paid by insurer" total. A plain number, no currency symbol.',
    },
    patient_responsibility: {
      label: 'Patient responsibility',
      type: 'number',
      description:
        'What the patient owes after the plan paid — copay, coinsurance, and ' +
        'deductible combined, usually labelled "patient responsibility" or ' +
        '"you may owe". A plain number, no currency symbol. This is what the ' +
        'provider will bill; the EOB itself is not a bill.',
    },
  },
};

export default explanationOfBenefits;
