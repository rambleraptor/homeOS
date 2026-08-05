/**
 * Prescription — a prescriber's order for a medication, or the pharmacy label
 * that dispenses it, with the drug, dose, directions, and refills.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Every
 * `description` is handed to the model verbatim, so they say where a value sits
 * on the script or label and how to keep the two people (patient, prescriber)
 * distinct.
 *
 * `patient` is shared with the other medical types on purpose. Both `patient`
 * and `prescriber` are person fields, so each joins the person filter facet.
 */

import type { DocType } from './docType';

const prescription: DocType = {
  id: 'prescription',
  label: 'Prescription',
  icon: () => import('lucide-react').then((m) => m.Pill),
  category: 'medical',
  title_template: 'Prescription — {medication}',
  description:
    'A prescription (Rx) — a prescriber\'s written order for a medication, or ' +
    'the pharmacy label/printout that dispenses it. Names the medication, its ' +
    'dose and directions, the quantity and refills, the prescribing doctor, and ' +
    'the pharmacy. Use this type for a prescription order or a filled-medication ' +
    'label; do not use it for a pharmacy purchase receipt (that is a medical ' +
    'receipt) or a general visit summary.',
  fields: {
    patient: {
      label: 'Patient',
      type: 'string',
      person: true,
      description:
        'The person the medication is prescribed for, as named on the script ' +
        'or label — not the prescriber.',
    },
    medication: {
      label: 'Medication',
      type: 'string',
      description:
        'The name of the drug prescribed, including strength when given (e.g. ' +
        '"Lisinopril 10 mg", "Amoxicillin 500 mg"). The medication name, not ' +
        'the directions.',
    },
    dosage: {
      label: 'Dosage / strength',
      type: 'string',
      description:
        'The strength or form of the medication, when stated separately from ' +
        'the name (e.g. "10 mg tablet", "250 mg/5 mL suspension"). Leave blank ' +
        'if already captured in the medication name.',
    },
    directions: {
      label: 'Directions',
      type: 'string',
      description:
        'How to take the medication — the "sig" or directions (e.g. "Take one ' +
        'tablet by mouth daily"). Record it as printed.',
    },
    quantity: {
      label: 'Quantity',
      type: 'string',
      description:
        'The amount dispensed or prescribed, as written (e.g. "30 tablets", ' +
        '"90"). Keep the unit if one is shown. Leave blank if not stated.',
    },
    refills: {
      label: 'Refills',
      type: 'string',
      description:
        'The number of refills authorised, as written (e.g. "2", "None", ' +
        '"PRN"). Leave blank if not shown.',
    },
    prescriber: {
      label: 'Prescriber',
      type: 'string',
      person: true,
      description:
        'The doctor or clinician who wrote the prescription, when named. The ' +
        'prescriber\'s name only, not the pharmacy. Leave blank if not shown.',
    },
    pharmacy: {
      label: 'Pharmacy',
      type: 'string',
      description:
        'The pharmacy that filled or would fill the prescription, when named ' +
        'on a label (e.g. "CVS Pharmacy #1234"). The pharmacy name only. Leave ' +
        'blank if not shown.',
    },
    date_written: {
      label: 'Date written',
      type: 'string',
      description:
        'The date the prescription was written or filled. Prefer an ISO date ' +
        '(YYYY-MM-DD) when unambiguous; otherwise record it exactly as shown.',
    },
  },
};

export default prescription;
