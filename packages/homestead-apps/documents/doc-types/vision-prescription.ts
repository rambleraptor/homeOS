/**
 * Eyeglass & vision prescription — the document an optometrist or ophthalmologist
 * issues after an eye exam, specifying the lens power to correct vision: sphere,
 * cylinder and axis, and add per eye, plus pupillary distance for glasses.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Every
 * `description` is handed to the model verbatim, so they say how to read the
 * per-eye values (right eye "OD", left eye "OS") into a single field.
 *
 * `prescriber` is shared with the other medical types on purpose (it is a person
 * field), so the prescribing doctor joins the person filter facet.
 */

import type { DocType } from './docType';

const visionPrescription: DocType = {
  id: 'vision-prescription',
  label: 'Eyeglass & vision prescription',
  icon: () => import('lucide-react').then((m) => m.Glasses),
  category: 'medical',
  title_template: 'Vision Prescription — {prescriber}',
  description:
    'An eyeglass or contact lens (vision) prescription — the document an ' +
    'optometrist or ophthalmologist issues after an eye exam, specifying the ' +
    'lens power needed to correct vision. Lists values for each eye (sphere, ' +
    'cylinder, axis, and add) plus pupillary distance for glasses, and is ' +
    'required to order corrective lenses. Use this type for a glasses or ' +
    'contact-lens prescription; do not use it for a medication prescription, an ' +
    'eye-exam bill, or an after-visit summary.',
  fields: {
    sphere: {
      label: 'Sphere (SPH)',
      type: 'string',
      description:
        'The spherical lens power correcting nearsightedness (minus values) or ' +
        'farsightedness (plus values), per eye. Record both eyes as printed, ' +
        'labelling right and left (e.g. "OD -2.00, OS -2.25"). OD is the right ' +
        'eye, OS the left.',
    },
    cylinder_axis: {
      label: 'Cylinder (CYL) & axis',
      type: 'string',
      description:
        'The cylinder power correcting astigmatism and its axis orientation ' +
        '(1–180 degrees), per eye. Record both eyes as printed (e.g. "OD -1.00 ' +
        'x 180, OS -0.75 x 175"). Leave blank if no astigmatism correction is ' +
        'given.',
    },
    add: {
      label: 'Add',
      type: 'string',
      description:
        'The additional magnifying power for reading in bifocal or progressive ' +
        'lenses (the "ADD" or "NV" value), per eye when given. Leave blank if ' +
        'the prescription lists none.',
    },
    pupillary_distance: {
      label: 'Pupillary distance (PD)',
      type: 'string',
      description:
        'The distance between the pupils in millimetres, needed to centre ' +
        'glasses lenses. Labelled "PD". Record it as printed (a single number, ' +
        'or separate near/far or per-eye values when given). Leave blank if not ' +
        'shown.',
    },
    prescriber: {
      label: 'Prescribing doctor',
      type: 'string',
      person: true,
      description:
        'The optometrist or ophthalmologist who issued the prescription, when ' +
        'named. The prescriber\'s name only, not the retailer or clinic.',
    },
    expiration_date: {
      label: 'Expiration date',
      type: 'string',
      description:
        'The date the prescription lapses and a new exam is required (typically ' +
        'one to two years after the exam). Prefer an ISO date (YYYY-MM-DD) when ' +
        'unambiguous; otherwise record it exactly as shown.',
    },
  },
};

export default visionPrescription;
