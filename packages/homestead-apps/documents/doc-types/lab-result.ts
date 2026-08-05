/**
 * Lab result — the report from a clinical laboratory showing the measured values
 * from a blood, urine, or other diagnostic test, each compared against a
 * reference range, with the ordering provider, the panel, and any out-of-range
 * values flagged.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Every
 * `description` is handed to the model verbatim, so they say how to summarise a
 * table of results into one field and to keep the reference range with the value.
 *
 * `provider` is shared with the other medical types on purpose, so the ordering
 * provider joins the same filter facet.
 */

import type { DocType } from './docType';

const labResult: DocType = {
  id: 'lab-result',
  label: 'Lab results',
  icon: () => import('lucide-react').then((m) => m.FlaskConical),
  category: 'medical',
  title_template: 'Lab Result — {test_name}',
  description:
    'A laboratory or diagnostic test result report — bloodwork, urinalysis, a ' +
    'pathology report, or a direct-to-consumer lab test — showing the measured ' +
    'values for each analyte with units, the lab\'s reference range, and a flag ' +
    '(H high, L low) on any value outside the range. Issued by a lab (e.g. ' +
    'Quest, LabCorp) or a hospital lab, usually via the ordering provider. Use ' +
    'this type for a report of test results; do not use it for an imaging order, ' +
    'a visit summary, or a bill for lab work.',
  fields: {
    provider: {
      label: 'Ordering provider',
      type: 'string',
      description:
        'The clinician who ordered the test (the "ordering provider" or ' +
        '"requested by"). The provider name only, not the performing lab. Leave ' +
        'blank if not shown.',
    },
    test_name: {
      label: 'Test / panel name',
      type: 'string',
      description:
        'The name of the test or panel measured (e.g. "Complete Blood Count", ' +
        '"Lipid Panel", "Hemoglobin A1c"). If the report covers several panels, ' +
        'give the primary or most prominent one.',
    },
    results: {
      label: 'Result values',
      type: 'string',
      description:
        'The measured values for the key analytes, each with its units (e.g. ' +
        '"Glucose 105 mg/dL; Total cholesterol 180 mg/dL; A1c 5.4%"). ' +
        'Summarise the important results; do not transcribe the whole table.',
    },
    reference_range: {
      label: 'Reference range',
      type: 'string',
      description:
        'The normal reference range the lab compares each value against, paired ' +
        'with the analyte when given (e.g. "Glucose 70–99 mg/dL"). Ranges are ' +
        'lab-specific — record them as printed on this report.',
    },
    flags: {
      label: 'Flags',
      type: 'string',
      description:
        'Any values flagged outside the reference range — "H" (high), "L" ' +
        '(low), or "abnormal" — named with their analyte (e.g. "Glucose H, LDL ' +
        'H"). Leave blank if every result is within range.',
    },
    collection_date: {
      label: 'Collection date',
      type: 'string',
      description:
        'The date the sample was collected or the test was taken (the ' +
        '"collected" date) — the point the values reflect, not the date the ' +
        'report was generated. Prefer an ISO date (YYYY-MM-DD) when unambiguous; ' +
        'otherwise record it exactly as shown.',
    },
  },
};

export default labResult;
