/**
 * Doctor's note — a short verification a licensed provider issues confirming a
 * patient was seen and stating the dates they should be excused from work or
 * school, plus any return date or restrictions. It verifies a medical absence
 * without disclosing the diagnosis.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Every
 * `description` is handed to the model verbatim, so they say where a value sits
 * on the note and how to read the excused/return dates apart.
 *
 * `patient`, `provider`, and `facility` are shared with the other medical types
 * on purpose, so the person, issuing clinician, and place join the same filter
 * facets.
 */

import type { DocType } from './docType';

const doctorNote: DocType = {
  id: 'doctor-note',
  label: "Doctor's note",
  icon: () => import('lucide-react').then((m) => m.FileCheck),
  category: 'medical',
  title_template: "Doctor's Note — {patient}",
  description:
    "A doctor's note — also called a medical excuse or sick note — a short " +
    'document from a licensed healthcare provider confirming a patient was seen ' +
    'and stating the dates they should be excused from work or school, plus any ' +
    'return date or restrictions. It verifies a medical absence and generally ' +
    "carries the provider's letterhead and signature, but under privacy rules " +
    'need not state the diagnosis. Use this type for a work/school excuse or ' +
    'return-to-work release; do not use it for an after-visit summary, a ' +
    'prescription, or an FMLA medical certification form.',
  fields: {
    patient: {
      label: 'Patient name',
      type: 'string',
      person: true,
      description: 'The person the note excuses, as named on the note.',
    },
    provider: {
      label: 'Issuing provider',
      type: 'string',
      description:
        'The physician, clinic, or hospital that issued the note — usually on ' +
        'the letterhead or by the signature. The provider name only.',
    },
    facility: {
      label: 'Facility / clinic',
      type: 'string',
      description:
        'Where care was delivered, when named separately from the issuing ' +
        'provider. The facility name only. Leave blank if not shown or the same ' +
        'as the provider.',
    },
    date_issued: {
      label: 'Date issued',
      type: 'string',
      description:
        'The date the note was written — typically the appointment date. ' +
        'Prefer an ISO date (YYYY-MM-DD) when unambiguous; otherwise record it ' +
        'exactly as shown.',
    },
    excused_from: {
      label: 'Excused from',
      type: 'string',
      description:
        'What the note excuses the patient from: "work", "school", or "both". ' +
        'Infer it from the wording (e.g. an employer address implies work).',
    },
    absence_dates: {
      label: 'Absence dates',
      type: 'string',
      description:
        'The dates the patient is excused — the first day, and the range if a ' +
        'span is given (e.g. "2026-03-04 to 2026-03-06"). Record as printed. ' +
        'Distinct from the return date below.',
    },
    return_date: {
      label: 'Return date',
      type: 'string',
      description:
        'The date the patient may return to work or school, when stated. ' +
        'Prefer an ISO date (YYYY-MM-DD) when unambiguous; otherwise record it ' +
        'exactly as shown. Leave blank if none is given.',
    },
    restrictions: {
      label: 'Restrictions',
      type: 'string',
      description:
        'Any limitations on return, when stated (e.g. "light duty", "no ' +
        'lifting over 10 lbs", "no PE"). Leave blank if the note lists none.',
    },
  },
};

export default doctorNote;
