/**
 * Immunization record — an official record of the vaccines a person has
 * received: the vaccine name, date administered, dose/series, administering
 * provider, and lot number. The proof of vaccination schools, jobs, and travel
 * ask for.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Every
 * `description` is handed to the model verbatim, so they say how to read a
 * single most-relevant dose off a list.
 *
 * `patient` and `provider` are shared with the other medical types on purpose,
 * so the person and the administering clinic join the same filter facets.
 */

import type { DocType } from './docType';

const immunizationRecord: DocType = {
  id: 'immunization-record',
  label: 'Immunization record',
  icon: () => import('lucide-react').then((m) => m.Syringe),
  category: 'medical',
  title_template: 'Immunization — {vaccine}',
  description:
    'An immunization or vaccination record — an official document listing the ' +
    'vaccines a person has received, with the vaccine name, date administered, ' +
    'and often the dose/series, administering provider, and lot number. Includes ' +
    'school/childhood immunization forms, a COVID-19 or flu vaccination card, ' +
    'and travel vaccination certificates. Use this type for a record of vaccines ' +
    'given; do not use it for a general visit summary, a lab result, or a ' +
    'prescription.',
  fields: {
    patient: {
      label: 'Patient name',
      type: 'string',
      person: true,
      description:
        'The person the immunization record belongs to, as named on the record.',
    },
    vaccine: {
      label: 'Vaccine name',
      type: 'string',
      description:
        'The vaccine or vaccines recorded (e.g. "COVID-19 (Pfizer)", "MMR", ' +
        '"Tdap", "Influenza"). If several are listed, give the most recent or ' +
        'most prominent one; separate multiple with commas if the record is a ' +
        'short list.',
    },
    date_administered: {
      label: 'Date administered',
      type: 'string',
      description:
        'The date the vaccine was given, used to determine boosters and ' +
        'compliance. If the record lists several doses, take the most recent ' +
        'administration date. Prefer an ISO date (YYYY-MM-DD) when unambiguous; ' +
        'otherwise record it exactly as shown.',
    },
    dose: {
      label: 'Dose / series',
      type: 'string',
      description:
        'Which dose in a series this entry represents, when stated (e.g. "1st ' +
        'dose", "booster", "2 of 2"). Leave blank if the record does not say.',
    },
    provider: {
      label: 'Administering provider',
      type: 'string',
      description:
        'The clinic, pharmacy, health department, or provider that ' +
        'administered the vaccine, when named. The facility or provider name ' +
        'only. Leave blank if not shown.',
    },
    lot_number: {
      label: 'Lot number',
      type: 'string',
      description:
        'The manufacturer lot number of the dose, labelled "Lot" or "Lot #", ' +
        'when recorded, kept for traceability. Record it exactly as printed. ' +
        'Leave blank if not shown.',
    },
  },
};

export default immunizationRecord;
