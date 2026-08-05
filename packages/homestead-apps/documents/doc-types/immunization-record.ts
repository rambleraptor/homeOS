/**
 * Immunization record — an official record of vaccines a person has received,
 * often needed for school, work, or travel.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Every
 * `description` is handed to the model verbatim, so they say where a value sits
 * on the record and how to read a single most-relevant dose off a list.
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
    'vaccines a person has received, with dates and often the administering ' +
    'clinic. Includes school/childhood immunization forms, a COVID-19 or flu ' +
    'vaccination card, and travel vaccination certificates. Use this type for a ' +
    'record of vaccines given; do not use it for a general visit summary, a ' +
    'lab result, or a prescription.',
  fields: {
    patient: {
      label: 'Patient',
      type: 'string',
      person: true,
      description:
        'The person the immunizations were given to, as named on the record.',
    },
    vaccine: {
      label: 'Vaccine',
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
        'The date the vaccine was given. If the record lists several doses, ' +
        'take the most recent administration date. Prefer an ISO date ' +
        '(YYYY-MM-DD) when unambiguous; otherwise record it exactly as shown.',
    },
    provider: {
      label: 'Administered by',
      type: 'string',
      description:
        'The clinic, pharmacy, health department, or provider that ' +
        'administered the vaccine, when named. The facility or provider name ' +
        'only. Leave blank if not shown.',
    },
    dose: {
      label: 'Dose',
      type: 'string',
      description:
        'Which dose in a series this is, when stated (e.g. "1st dose", ' +
        '"booster", "2 of 2"). Leave blank if the record does not say.',
    },
    lot_number: {
      label: 'Lot number',
      type: 'string',
      description:
        'The manufacturer lot number of the dose, labelled "Lot" or "Lot #", ' +
        'when recorded. Record it exactly as printed. Leave blank if not shown.',
    },
    next_dose_due: {
      label: 'Next dose due',
      type: 'string',
      description:
        'The date the next dose or booster is due, when the record gives one. ' +
        'Prefer an ISO date (YYYY-MM-DD) when unambiguous; otherwise record it ' +
        'exactly as shown. Leave blank if none is stated.',
    },
  },
};

export default immunizationRecord;
