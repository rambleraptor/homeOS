/**
 * After-visit summary — the recap a clinic or doctor's office hands over after
 * an outpatient visit: why you came, what was found, and what to do next.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Every
 * `description` is handed to the model verbatim, so they say where a value sits
 * on the summary and how to keep an outpatient recap distinct from a hospital
 * discharge.
 *
 * `patient`, `provider`, and `facility` are shared with the other medical types
 * on purpose, so the person, clinician, and place join the same filter facets.
 */

import type { DocType } from './docType';

const afterVisitSummary: DocType = {
  id: 'after-visit-summary',
  label: 'After-visit summary',
  icon: () => import('lucide-react').then((m) => m.ClipboardList),
  category: 'medical',
  title_template: 'After-Visit Summary — {provider}',
  description:
    'An after-visit summary (AVS) or visit summary — the recap a clinic or ' +
    'doctor\'s office gives a patient after an outpatient appointment. It ' +
    'covers the reason for the visit, what was assessed or diagnosed, and the ' +
    'care instructions and follow-up. Use this type for an outpatient visit ' +
    'recap; do not use it for a hospital discharge summary (an inpatient stay), ' +
    'a lab result, or a bill.',
  fields: {
    patient: {
      label: 'Patient',
      type: 'string',
      person: true,
      description:
        'The person the visit was for, as named on the summary.',
    },
    provider: {
      label: 'Provider',
      type: 'string',
      description:
        'The doctor or clinician the patient saw, when named. The provider ' +
        'name only, not the facility. Leave blank if not shown.',
    },
    facility: {
      label: 'Facility',
      type: 'string',
      description:
        'The clinic, practice, or office where the visit took place, when ' +
        'named. The facility name only. Leave blank if not shown.',
    },
    visit_date: {
      label: 'Visit date',
      type: 'string',
      description:
        'The date of the appointment this summary is for. Prefer an ISO date ' +
        '(YYYY-MM-DD) when unambiguous; otherwise record it exactly as shown.',
    },
    reason_for_visit: {
      label: 'Reason for visit',
      type: 'string',
      description:
        'Why the patient came in — the chief complaint or reason for the ' +
        'visit, as stated (e.g. "Annual physical", "Sore throat and fever").',
    },
    diagnoses: {
      label: 'Diagnoses',
      type: 'string',
      description:
        'The assessment or diagnoses recorded at the visit, summarised. List ' +
        'multiple separated by commas. Leave blank if none is stated.',
    },
    instructions: {
      label: 'Instructions',
      type: 'string',
      description:
        'The care instructions given to the patient — medications, activity, ' +
        'self-care, or warning signs to watch for. Summarise the key points.',
    },
    follow_up: {
      label: 'Follow-up',
      type: 'string',
      description:
        'Any follow-up recommended — a return visit, referral, or test, with ' +
        'timing when given (e.g. "Recheck in 2 weeks", "Referral to ' +
        'cardiology"). Leave blank if none is stated.',
    },
  },
};

export default afterVisitSummary;
