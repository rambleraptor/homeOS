/**
 * Appliance manual — the owner's manual / user guide for a household appliance
 * or home system (refrigerator, washer, furnace, water heater, HVAC unit, ...).
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Every
 * `description` is handed to the model verbatim, so they name where a value sits
 * in the document and how to distinguish it from a neighbouring one.
 *
 * The point of this type isn't to store the manual's prose — the file's text is
 * already extracted and embedded for search — but to pull out the handful of
 * identifiers that pin the manual to a physical thing you own: the brand, what
 * kind of appliance it is, and the model/serial numbers you need to order a
 * filter, look up a part, or register a warranty. Those identifiers are what a
 * future Home app's asset inventory keys on, so `brand`, `model_number`, and
 * `serial_number` are deliberately named the same as on the `warranty` type —
 * they mean the same thing on either document and share one column and filter
 * facet across both.
 */

import type { DocType } from './docType';

const applianceManual: DocType = {
  id: 'appliance-manual',
  label: 'Appliance manual',
  icon: () => import('lucide-react').then((m) => m.BookOpen),
  category: 'home',
  title_template: '{brand} {product_type} — Manual',
  description:
    "An owner's manual, user guide, installation guide, or quick-start booklet " +
    'for a household appliance or home system — a refrigerator, oven, ' +
    'dishwasher, washer or dryer, furnace, air conditioner, water heater, ' +
    'garbage disposal, thermostat, or similar. Identifies the product by brand ' +
    'and model, explains how to operate and maintain it, and usually lists ' +
    'specifications, part numbers, and manufacturer support contacts. Use this ' +
    'type for the manual or spec sheet of an appliance or home system; do not ' +
    'use it for a purchase receipt, a warranty or protection plan, or the ' +
    'manual for a non-household product (a phone, a car).',
  fields: {
    brand: {
      label: 'Brand',
      type: 'string',
      description:
        'The manufacturer or brand that made the appliance (e.g. "Whirlpool", ' +
        '"GE", "Bosch", "Carrier"). The maker\'s name only — not the retailer ' +
        'it was bought from and not the product/model name.',
    },
    product_type: {
      label: 'Appliance type',
      type: 'string',
      description:
        'What kind of appliance or home system the manual is for, as a short ' +
        'common noun (e.g. "refrigerator", "dishwasher", "furnace", "water ' +
        'heater", "thermostat"). The category of thing, not its model name.',
    },
    model_name: {
      label: 'Model name',
      type: 'string',
      description:
        'The marketing or series name of the product when the manual gives one ' +
        '(e.g. "Profile", "Café", "Elite"). Distinct from the model number ' +
        'below. Leave blank if the manual only shows a model number.',
    },
    model_number: {
      label: 'Model number',
      type: 'string',
      description:
        'The manufacturer\'s model or catalog number — the identifier used to ' +
        'order parts, filters, and accessories. Often labelled "Model", ' +
        '"Model No.", or "M/N" on the rating plate or the manual\'s cover. ' +
        'Record it exactly as printed, including letters and dashes. Not the ' +
        'serial number.',
    },
    serial_number: {
      label: 'Serial number',
      type: 'string',
      description:
        'The unique serial number of the individual unit, when the manual or an ' +
        'affixed label shows one. Labelled "Serial", "Serial No.", or "S/N", and ' +
        'unique to the one physical unit (unlike the model number, shared across ' +
        'every unit of that model). Record it exactly as printed. Leave blank if ' +
        'the manual shows only a model number.',
    },
    support_contact: {
      label: 'Support contact',
      type: 'string',
      description:
        'The manufacturer\'s customer-support or service phone number or website ' +
        'for this product, when the manual lists one (e.g. "1-800-253-1301" or ' +
        '"whirlpool.com/support"). The maker\'s support line, not a retailer or ' +
        'an installer.',
    },
  },
};

export default applianceManual;
