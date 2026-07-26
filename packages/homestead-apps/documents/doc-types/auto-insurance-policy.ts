/**
 * Auto insurance policy — the contract between a driver and an insurer covering
 * losses from a vehicle (liability, collision, comprehensive, and more).
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Every
 * `description` is handed to the model verbatim, so they name where a value sits
 * on the policy (usually the declarations page) and how to distinguish it from a
 * neighbouring one.
 *
 * The document people reach for is almost always the declarations ("dec") page:
 * a one-page summary of the carrier, policy number, covered vehicles and
 * drivers, coverage limits, deductibles, premium, and the policy term. The full
 * policy booklet behind it spells out exclusions and claim procedures; the
 * fields below are the ones the dec page surfaces.
 */

import type { DocType } from './docType';

const autoInsurancePolicy: DocType = {
  id: 'auto-insurance-policy',
  label: 'Auto insurance policy',
  icon: () => import('lucide-react').then((m) => m.Car),
  description:
    'An auto (car) insurance policy — the contract between a driver and an ' +
    'insurance carrier that covers losses from a vehicle: liability, collision, ' +
    'comprehensive, uninsured-motorist, and medical payments. Most often the ' +
    'declarations ("dec") page: a one-page summary naming the carrier, a policy ' +
    'number, the covered vehicles (by VIN) and named drivers, coverage limits, ' +
    'deductibles, the premium, and the policy term (usually a 6- or 12-month ' +
    'period). Use this type for a policy, declarations page, or renewal notice; ' +
    'do not use it for a proof-of-insurance/ID card, a bill or invoice on its ' +
    'own, a claim document, or a home/health/life insurance policy.',
  fields: {
    carrier: {
      label: 'Carrier',
      type: 'string',
      description:
        'The insurance company that issued the policy (e.g. "GEICO", "State ' +
        'Farm", "Progressive"). The insurer\'s name only, not an agent or agency ' +
        'name and not the insured person.',
    },
    policy_number: {
      label: 'Policy number',
      type: 'string',
      description:
        'The unique identifier for this policy, used on every claim and ID card. ' +
        'Labelled "Policy Number" or "Policy No." near the top of the ' +
        'declarations page. Record it exactly as printed, including any letters ' +
        'and dashes. Not the account, quote, or claim number.',
    },
    named_insured: {
      label: 'Named insured',
      type: 'string',
      description:
        'The primary policyholder — the person (or people) the policy is issued ' +
        'to, from the "Named Insured" block. The account holder, distinct from ' +
        'the list of covered drivers below.',
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
        'unambiguous; otherwise record it exactly as shown. A term is usually 6 ' +
        'or 12 months after the start date.',
    },
    premium: {
      label: 'Premium',
      type: 'number',
      description:
        'The total premium charged for the policy term — what the coverage ' +
        'costs. A plain number, no currency symbol. Prefer the total/full-term ' +
        'premium over an installment or monthly amount when both are shown.',
    },
    covered_vehicles: {
      label: 'Covered vehicles',
      type: 'array',
      description:
        'The vehicles insured under the policy, one array entry per vehicle. ' +
        'Preserve the order they are listed on the declarations page.',
      items: {
        label: 'Vehicle',
        type: 'object',
        properties: {
          vehicle: {
            label: 'Vehicle',
            type: 'string',
            description:
              'The vehicle as printed — typically year, make, and model (e.g. ' +
              '"2019 Honda Civic"). Null if not shown.',
          },
          vin: {
            label: 'VIN',
            type: 'string',
            description:
              'The vehicle identification number (VIN) for this vehicle. Record ' +
              'it exactly as printed. Null if not shown.',
          },
        },
      },
    },
    covered_drivers: {
      label: 'Covered drivers',
      type: 'array',
      description:
        'The names of the drivers covered by the policy, from the "Drivers" or ' +
        '"Rated Drivers" section. One array entry per driver, names only. ' +
        'Empty/null if none are listed.',
      items: {
        label: 'Driver',
        type: 'string',
        description: 'A single covered driver’s name, as printed.',
      },
    },
    coverages: {
      label: 'Coverages',
      type: 'array',
      description:
        'The coverages the policy provides, one array entry per line on the ' +
        'declarations page (e.g. bodily injury liability, property damage ' +
        'liability, collision, comprehensive, uninsured motorist, medical ' +
        'payments). Preserve the order shown.',
      items: {
        label: 'Coverage',
        type: 'object',
        properties: {
          type: {
            label: 'Coverage type',
            type: 'string',
            description:
              'The name of the coverage as printed (e.g. "Bodily Injury ' +
              'Liability", "Collision", "Comprehensive").',
          },
          limit: {
            label: 'Limit',
            type: 'string',
            description:
              'The coverage limit — the most the insurer pays for this coverage, ' +
              'as printed. Often a per-person/per-accident pair (e.g. ' +
              '"$100,000 / $300,000") or a single amount; record it verbatim. ' +
              'Null when the coverage has no stated limit.',
          },
          deductible: {
            label: 'Deductible',
            type: 'number',
            description:
              'The deductible for this coverage — what the insured pays out of ' +
              'pocket before it kicks in (mainly on collision and comprehensive). ' +
              'A plain number, no currency symbol. Null when no deductible ' +
              'applies to this coverage.',
          },
        },
      },
    },
  },
};

export default autoInsurancePolicy;
