/**
 * After-visit summary — the recap a clinic or doctor's office hands over after a
 * medical encounter: the visit type and date, who you saw and where, the reason,
 * the diagnoses, and the instructions and next steps.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Every
 * `description` is handed to the model verbatim, so they say where a value sits
 * on the summary. The instructions field folds in medications, orders, and
 * follow-up — the actionable part — rather than splitting them out.
 *
 * `provider` and `facility` are shared with the other medical types on purpose,
 * so the clinician and place join the same filter facets.
 */

import type { DocType } from './docType';

const afterVisitSummary: DocType = {
  id: 'after-visit-summary',
  label: 'After-visit summary',
  icon: () => import('lucide-react').then((m) => m.ClipboardList),
  category: 'medical',
  title_template: 'After-Visit Summary — {provider}',
  description:
    'An after-visit summary (AVS) — sometimes called a clinical visit summary — ' +
    'is the recap a provider gives a patient at the end of a single encounter: ' +
    'a doctor visit, urgent care, ER, telehealth appointment, or a hospital ' +
    'discharge. It pulls that one visit into a single patient-facing document: ' +
    'the visit type and date, who was seen and where, the reason for the visit, ' +
    'the diagnoses made, and the instructions and next steps (medications, ' +
    'orders, referrals, and when to return). It is a summary of one visit, not ' +
    'a full medical record. Use this type for such a per-visit recap; do not use ' +
    'it for a lab result, a prescription on its own, or a bill.',
  fields: {
    visit_type: {
      label: 'Visit type',
      type: 'string',
      description:
        'The kind of encounter this recap is for, e.g. "Annual physical", ' +
        '"Follow-up", "Urgent care", "ER", or "Telehealth". Infer it from the ' +
        'summary when not stated outright.',
    },
    visit_date: {
      label: 'Date of visit',
      type: 'string',
      description:
        'The date the encounter happened. Prefer an ISO date (YYYY-MM-DD) when ' +
        'the parts are unambiguous; otherwise record it exactly as shown. Not ' +
        'the date the summary was printed if they differ.',
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
        'The clinic, practice, hospital, or office where the visit took place, ' +
        'when named. The facility name only. Leave blank if not shown.',
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
      label: 'Instructions & next steps',
      type: 'string',
      description:
        'The actionable part of the summary — new medications, lab or imaging ' +
        'orders, referrals, self-care instructions, and when to return or ' +
        'follow up. Summarise the key points.',
    },
  },
};

export default afterVisitSummary;
