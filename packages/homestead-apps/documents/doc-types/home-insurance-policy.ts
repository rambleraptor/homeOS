/**
 * Homeowners (or renters) insurance policy — the contract covering a home and
 * its contents against losses like fire, theft, and storm damage, plus the
 * owner's liability if someone is injured on the property.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Every
 * `description` is handed to the model verbatim, so they name where a value sits
 * on the policy (usually the declarations page) and how to distinguish it from a
 * neighbouring one.
 *
 * The document people reach for is almost always the declarations ("dec") page:
 * a one-page summary of the carrier, the insured address, the dwelling and
 * liability limits, the deductible, the premium, and the policy term. The full
 * policy booklet behind it spells out covered perils, exclusions, and the claims
 * process; the fields below are the ones the dec page surfaces. Several field
 * names are shared with the auto-insurance-policy type on purpose (`carrier`,
 * `policy_number`, `named_insured`, `policy_term_start`/`policy_term_end`,
 * `premium`): they mean the same thing on either dec page, so they share one
 * metadata column and one filter/search facet across both types.
 */

import type { DocType } from './docType';

const homeInsurancePolicy: DocType = {
  id: 'home-insurance-policy',
  label: 'Home insurance policy',
  icon: () => import('lucide-react').then((m) => m.House),
  description:
    'A homeowners (or renters) insurance policy — the contract between a ' +
    'homeowner or renter and an insurance carrier that covers the home and ' +
    'belongings against losses like fire, theft, and storm damage, and covers ' +
    'the insured\'s liability if someone is injured on the property. Most often ' +
    'the declarations ("dec") page: a one-page summary naming the carrier, a ' +
    'policy number, the insured property address, the dwelling and liability ' +
    'coverage limits, the deductible, the premium, and the policy term (usually ' +
    'a 12-month period). Use this type for a homeowners, condo, or renters ' +
    'policy, its declarations page, or a renewal notice; do not use it for a ' +
    'bill or invoice on its own, a claim document, or an auto/health/life ' +
    'insurance policy.',
  fields: {
    carrier: {
      label: 'Carrier',
      type: 'string',
      description:
        'The insurance company that issued the policy (e.g. "State Farm", ' +
        '"Allstate", "Liberty Mutual"). The insurer\'s name only, not an agent ' +
        'or agency name and not the insured person.',
    },
    policy_number: {
      label: 'Policy number',
      type: 'string',
      description:
        'The unique identifier for this policy, used on every claim and renewal. ' +
        'Labelled "Policy Number" or "Policy No." near the top of the ' +
        'declarations page. Record it exactly as printed, including any letters ' +
        'and dashes. Not the account, quote, or claim number.',
    },
    named_insured: {
      label: 'Named insured',
      type: 'string',
      person: true,
      description:
        'The primary policyholder — the person (or people) the policy is issued ' +
        'to, from the "Named Insured" block. The account holder, distinct from ' +
        'the insured property address below.',
    },
    insured_property: {
      label: 'Insured property',
      type: 'string',
      description:
        'The address of the home the policy covers — the "insured location" or ' +
        '"described location", not the mailing address if the two differ. Record ' +
        'the full street address as printed.',
    },
    policy_term_start: {
      label: 'Policy term start',
      type: 'string',
      description:
        'The date coverage begins for this term (the "from"/"effective" date of ' +
        'the policy period). Prefer an ISO date (YYYY-MM-DD) when the parts are ' +
        'unambiguous; otherwise record it exactly as shown.',
    },
    policy_term_end: {
      label: 'Policy term end',
      type: 'string',
      description:
        'The date this term expires (the "to"/"expiration" date of the policy ' +
        'period) — the renewal date. Prefer an ISO date (YYYY-MM-DD) when ' +
        'unambiguous; otherwise record it exactly as shown. A homeowners term is ' +
        'usually 12 months after the start date.',
    },
    premium: {
      label: 'Premium',
      type: 'number',
      description:
        'The total premium charged for the policy term — what the coverage ' +
        'costs. A plain number, no currency symbol. Prefer the total/full-term ' +
        'premium over an installment or monthly amount when both are shown.',
    },
    dwelling_coverage: {
      label: 'Dwelling coverage (Coverage A)',
      type: 'number',
      description:
        'The limit to rebuild the home — "Coverage A" or "Dwelling" on the ' +
        'declarations page. Reflects the cost to rebuild, not the market or ' +
        'purchase price. A plain number, no currency symbol. Not the personal-' +
        'property (Coverage C) or other-structures (Coverage B) limit.',
    },
    liability_coverage: {
      label: 'Liability coverage',
      type: 'number',
      description:
        'The personal-liability limit — the most the insurer pays for injuries ' +
        'or property damage the insured is legally responsible for. Often ' +
        'labelled "Personal Liability" or "Coverage E". A plain number, no ' +
        'currency symbol. Not the medical-payments (Coverage F) limit.',
    },
    deductible: {
      label: 'Deductible',
      type: 'string',
      description:
        'What the insured pays out of pocket before a claim pays out. Record it ' +
        'as printed: usually a dollar amount (e.g. "$1,000"), but sometimes a ' +
        'percentage of the dwelling limit (e.g. "2%") for wind/hail or ' +
        'hurricane losses. If separate deductibles are shown, take the standard ' +
        'all-perils one.',
    },
  },
};

export default homeInsurancePolicy;
