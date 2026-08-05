/**
 * Explanation of Benefits (EOB) — the statement a health insurer sends after
 * processing a claim, showing what was billed, what the plan paid, and what the
 * patient owes.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Every
 * `description` is handed to the model verbatim, so they name where a value sits
 * on the statement and how to tell an EOB apart from the bill it explains.
 *
 * The single most important distinction the model must make: an EOB is *not* a
 * bill. It usually says so in bold ("This is not a bill"). The provider's own
 * invoice is the `medical-bill` type; a paid store/pharmacy receipt is
 * `medical-receipt`. Several field names are shared on purpose — `carrier` with
 * the insurance types, `provider`/`service_date`/`patient`/`amount_billed` with
 * `medical-bill` — so they share one metadata column and one filter facet.
 */

import type { DocType } from './docType';

const explanationOfBenefits: DocType = {
  id: 'explanation-of-benefits',
  label: 'Explanation of Benefits',
  icon: () => import('lucide-react').then((m) => m.ReceiptText),
  category: 'medical',
  title_template: 'EOB — {provider} ({service_date})',
  description:
    'An Explanation of Benefits (EOB) — a statement a health insurance company ' +
    'sends a member after it processes a claim. It shows the service that was ' +
    'billed, the amount the provider charged, the amount the plan allowed and ' +
    'paid, and the amount the patient is responsible for. Almost always marked ' +
    '"This is not a bill". Use this type for an insurer\'s benefits statement; ' +
    'do not use it for the provider\'s actual bill or invoice (that is a ' +
    'medical bill), nor for a paid pharmacy/clinic receipt.',
  fields: {
    carrier: {
      label: 'Insurer',
      type: 'string',
      description:
        'The health insurance company that issued the statement and processed ' +
        'the claim (e.g. "Aetna", "Blue Cross Blue Shield", "UnitedHealthcare"). ' +
        'The insurer\'s name only, not the employer plan sponsor or the provider.',
    },
    patient: {
      label: 'Patient',
      type: 'string',
      person: true,
      description:
        'The person who received the care, as named on the statement — the ' +
        'patient, not the plan subscriber or member if they differ.',
    },
    provider: {
      label: 'Provider',
      type: 'string',
      description:
        'The doctor, clinic, hospital, or facility that provided the service ' +
        'the claim covers. The rendering provider\'s name, not the insurer.',
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
      label: 'Date of service',
      type: 'string',
      description:
        'The date the care was provided (the "date of service"), not the date ' +
        'the statement was printed or mailed. Prefer an ISO date (YYYY-MM-DD) ' +
        'when the parts are unambiguous; otherwise record it exactly as shown. ' +
        'If several service lines span dates, take the earliest.',
    },
    amount_billed: {
      label: 'Amount billed',
      type: 'number',
      description:
        'The total amount the provider charged before any insurer adjustment — ' +
        'the "billed"/"charged" column totalled across service lines. A plain ' +
        'number, no currency symbol.',
    },
    plan_paid: {
      label: 'Plan paid',
      type: 'number',
      description:
        'The total the insurance plan paid the provider — the "plan paid" or ' +
        '"amount paid by insurer" total. A plain number, no currency symbol.',
    },
    patient_responsibility: {
      label: 'Patient responsibility',
      type: 'number',
      description:
        'The total the patient owes — copay, deductible, and coinsurance ' +
        'combined, usually labelled "patient responsibility" or "you may owe". ' +
        'A plain number, no currency symbol. This is what the patient could be ' +
        'billed for; it is not itself a bill.',
    },
  },
};

export default explanationOfBenefits;
