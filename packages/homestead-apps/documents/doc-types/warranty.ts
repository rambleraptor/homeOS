/**
 * Warranty — a product warranty, protection plan, or extended service contract
 * for a household item (an appliance, a home system, electronics, furniture).
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Every
 * `description` is handed to the model verbatim, so they name where a value sits
 * in the document and how to distinguish it from a neighbouring one.
 *
 * The field that earns this type its keep is `coverage_end`: it's the date a
 * future Home app reminds you about before a warranty lapses. `brand`,
 * `model_number`, and `serial_number` are named the same as on the
 * `appliance-manual` type on purpose — they identify the same physical item on
 * either document and share one column and filter facet across both. The
 * warranty issuer is `warranty_provider` (not the medical `provider` other doc
 * types use) so the two stay separate columns.
 */

import type { DocType } from './docType';

const warranty: DocType = {
  id: 'warranty',
  label: 'Warranty',
  icon: () => import('lucide-react').then((m) => m.ShieldCheck),
  category: 'home',
  title_template: 'Warranty — {product}',
  description:
    'A product warranty, protection plan, extended service contract, or ' +
    'guarantee that covers a household item — an appliance, a home system, ' +
    'electronics, tools, or furniture — against defects or breakdown for a ' +
    'period of time. Names the covered product, who backs the coverage, what ' +
    'it covers, and the dates the coverage runs. Use this type for a warranty ' +
    'certificate, a registration confirmation stating a coverage period, or a ' +
    'purchased protection/service plan; do not use it for an insurance policy ' +
    '(home, auto, health), a plain purchase receipt with no coverage terms, or ' +
    'a product manual.',
  fields: {
    product: {
      label: 'Product',
      type: 'string',
      description:
        'The item the warranty covers, in a few words (e.g. "LG refrigerator", ' +
        '"Dewalt drill", "living-room sofa"). What is protected, not the company ' +
        'that provides the coverage.',
    },
    warranty_provider: {
      label: 'Provider',
      type: 'string',
      description:
        'Who backs the warranty and would honour a claim — the manufacturer for ' +
        'a standard warranty, or the plan administrator/retailer for a purchased ' +
        'protection plan (e.g. "Samsung", "Asurion", "Home Depot Protection ' +
        'Plan"). The party that pays out, not the store where the item was ' +
        'bought if that differs.',
    },
    brand: {
      label: 'Brand',
      type: 'string',
      description:
        'The manufacturer or brand of the covered product (e.g. "LG", ' +
        '"Dewalt"). The maker of the item — which may differ from the warranty ' +
        'provider when a third party administers the plan.',
    },
    model_number: {
      label: 'Model number',
      type: 'string',
      description:
        'The model or catalog number of the covered product, when the document ' +
        'shows one. Labelled "Model" or "Model No.". Record it exactly as ' +
        'printed. Not the serial number and not the warranty/plan number.',
    },
    serial_number: {
      label: 'Serial number',
      type: 'string',
      description:
        'The serial number of the specific covered unit, when shown ("Serial", ' +
        '"S/N") — unique to the one item, unlike the model number. Record it ' +
        'exactly as printed. Leave blank if absent.',
    },
    coverage_start: {
      label: 'Coverage start',
      type: 'string',
      description:
        'The date coverage begins — often the purchase or registration date, or ' +
        'an "effective"/"from" date. Prefer an ISO date (YYYY-MM-DD) when the ' +
        'parts are unambiguous; otherwise record it exactly as shown.',
    },
    coverage_end: {
      label: 'Coverage end',
      type: 'string',
      description:
        'The date coverage expires — the "expires", "through", or "valid until" ' +
        'date, the one that matters for a lapse reminder. If the document gives ' +
        'a length instead of a date (e.g. "2-year warranty"), compute it from ' +
        'the coverage start when that is known. Prefer an ISO date ' +
        '(YYYY-MM-DD) when unambiguous; otherwise record it exactly as shown.',
    },
    coverage_terms: {
      label: 'Coverage terms',
      type: 'string',
      description:
        'A short summary of what the warranty covers and any notable limits or ' +
        'exclusions (e.g. "parts and labor, excludes accidental damage", ' +
        '"compressor 10 years, rest 1 year"). One or two sentences, not the full ' +
        'legal text.',
    },
    claim_contact: {
      label: 'Claim contact',
      type: 'string',
      description:
        'The phone number or website to file a claim or reach warranty service, ' +
        'when the document lists one (e.g. "1-877-699-8324" or ' +
        '"asurion.com/claims"). Leave blank if not shown.',
    },
    cost: {
      label: 'Plan cost',
      type: 'number',
      description:
        'What the coverage cost, when it was a purchased protection or service ' +
        'plan with a price shown. A plain number, no currency symbol. Leave ' +
        'blank for a manufacturer warranty that came free with the product.',
    },
  },
};

export default warranty;
