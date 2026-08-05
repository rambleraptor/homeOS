/**
 * Discharge summary — the report a hospital produces when a patient leaves after
 * an inpatient stay: why they were admitted, what happened, and the plan for
 * home.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Every
 * `description` is handed to the model verbatim, so they say where a value sits
 * on the summary and how to keep an inpatient discharge distinct from an
 * outpatient after-visit summary.
 *
 * `patient` and `facility` are shared with the other medical types on purpose,
 * so the person and place join the same filter facets. `attending_provider` is a
 * person field, so it joins the person facet too.
 */

import type { DocType } from './docType';

const dischargeSummary: DocType = {
  id: 'discharge-summary',
  label: 'Discharge summary',
  icon: () => import('lucide-react').then((m) => m.ClipboardCheck),
  category: 'medical',
  title_template: 'Discharge Summary — {facility}',
  description:
    'A hospital discharge summary or discharge instructions — the report ' +
    'produced when a patient leaves the hospital after an inpatient stay or an ' +
    'emergency-department visit. Covers the admission and discharge dates, the ' +
    'reason for admission, the discharge diagnosis, medications to take home, ' +
    'and instructions and follow-up. Use this type for a hospital discharge; do ' +
    'not use it for a routine outpatient after-visit summary or a bill.',
  fields: {
    patient: {
      label: 'Patient',
      type: 'string',
      person: true,
      description:
        'The person who was admitted and discharged, as named on the summary.',
    },
    facility: {
      label: 'Facility',
      type: 'string',
      description:
        'The hospital or facility the patient was discharged from. The ' +
        'facility name only. Leave blank if not shown.',
    },
    attending_provider: {
      label: 'Attending provider',
      type: 'string',
      person: true,
      description:
        'The attending physician responsible for the stay, when named. The ' +
        'provider name only. Leave blank if not shown.',
    },
    admission_date: {
      label: 'Admission date',
      type: 'string',
      description:
        'The date the patient was admitted. Prefer an ISO date (YYYY-MM-DD) ' +
        'when unambiguous; otherwise record it exactly as shown. Leave blank if ' +
        'not shown.',
    },
    discharge_date: {
      label: 'Discharge date',
      type: 'string',
      description:
        'The date the patient was discharged. Prefer an ISO date (YYYY-MM-DD) ' +
        'when unambiguous; otherwise record it exactly as shown.',
    },
    discharge_diagnosis: {
      label: 'Discharge diagnosis',
      type: 'string',
      description:
        'The final or discharge diagnosis (or diagnoses), summarised. List ' +
        'multiple separated by commas. Distinct from the admitting diagnosis if ' +
        'both are given — take the discharge one.',
    },
    discharge_instructions: {
      label: 'Instructions',
      type: 'string',
      description:
        'The instructions given for care at home — activity, diet, wound care, ' +
        'or warning signs to watch for. Summarise the key points.',
    },
    medications: {
      label: 'Discharge medications',
      type: 'string',
      description:
        'The medications the patient is told to take after discharge, ' +
        'summarised as a comma-separated list. Leave blank if none is listed.',
    },
    follow_up: {
      label: 'Follow-up',
      type: 'string',
      description:
        'Any follow-up appointments or referrals recommended after discharge, ' +
        'with timing when given (e.g. "Follow up with PCP in 1 week"). Leave ' +
        'blank if none is stated.',
    },
  },
};

export default dischargeSummary;
