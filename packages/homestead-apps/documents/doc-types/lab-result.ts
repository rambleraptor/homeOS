/**
 * Lab result — the report of a laboratory or diagnostic test, listing the
 * analytes measured, their values, and the reference ranges.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Every
 * `description` is handed to the model verbatim, so they say where a value sits
 * on the report and how to summarise a table of results into one field.
 *
 * `patient` and `provider` are shared with the other medical types on purpose,
 * so the person and the ordering provider join the same filter facets.
 */

import type { DocType } from './docType';

const labResult: DocType = {
  id: 'lab-result',
  label: 'Lab result',
  icon: () => import('lucide-react').then((m) => m.FlaskConical),
  category: 'medical',
  title_template: 'Lab Result — {test_name}',
  description:
    'A laboratory or diagnostic test result report — bloodwork, urinalysis, a ' +
    'pathology report, or similar — listing the tests performed, their measured ' +
    'values, units, and reference ranges, with any out-of-range values flagged. ' +
    'Issued by a lab (e.g. Quest, LabCorp) or a hospital lab. Use this type for ' +
    'a report of test results; do not use it for an imaging order, a visit ' +
    'summary, or a bill for lab work.',
  fields: {
    patient: {
      label: 'Patient',
      type: 'string',
      person: true,
      description:
        'The person the test was performed on, as named on the report.',
    },
    provider: {
      label: 'Ordering provider',
      type: 'string',
      description:
        'The doctor or clinician who ordered the test, when named (the ' +
        '"ordering provider" or "requested by"). The provider name only, not ' +
        'the performing lab. Leave blank if not shown.',
    },
    test_name: {
      label: 'Test',
      type: 'string',
      description:
        'The name of the test or panel (e.g. "Complete Blood Count", "Lipid ' +
        'Panel", "Hemoglobin A1c"). If the report covers several panels, give ' +
        'the primary or most prominent one.',
    },
    collection_date: {
      label: 'Collection date',
      type: 'string',
      description:
        'The date the specimen was collected or the test was taken (the ' +
        '"collected" date), not the date the report was generated. Prefer an ' +
        'ISO date (YYYY-MM-DD) when unambiguous; otherwise record it as shown.',
    },
    result_date: {
      label: 'Result date',
      type: 'string',
      description:
        'The date the results were reported or finalised (the "reported"/' +
        '"resulted" date), when distinct from the collection date. Prefer an ' +
        'ISO date (YYYY-MM-DD) when unambiguous; otherwise record it as shown. ' +
        'Leave blank if not shown.',
    },
    specimen: {
      label: 'Specimen',
      type: 'string',
      description:
        'The type of specimen tested, when stated (e.g. "Blood", "Urine", ' +
        '"Serum", "Tissue"). Leave blank if the report does not say.',
    },
    results: {
      label: 'Results',
      type: 'string',
      description:
        'A short summary of the key measured values — the most important ' +
        'analytes with their values, and any flagged as high or low (e.g. ' +
        '"Glucose 105 mg/dL (High); Cholesterol 180 mg/dL"). Summarise; do not ' +
        'transcribe the whole table. Note any overall interpretation if one is ' +
        'given (e.g. "Normal", "Abnormal").',
    },
  },
};

export default labResult;
