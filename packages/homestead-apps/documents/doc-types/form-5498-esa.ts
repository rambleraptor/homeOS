/**
 * Form 5498-ESA — Coverdell education savings account contributions.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply.
 *
 * The contribution side of a Coverdell, as Form 5498 is for an IRA. Arrives in
 * April rather than January, after the contribution deadline has passed, so it
 * lands well after the rest of the year's tax post.
 */

import type { DocType } from './docType';

const form5498Esa: DocType = {
  id: 'form-5498-esa',
  label: 'Form 5498-ESA',
  icon: () => import('lucide-react').then((m) => m.PiggyBank),
  category: 'tax',
  title_template: '5498-ESA ({tax_year}) — {trustee_name}',
  description:
    'A US tax form reporting contributions made to a Coverdell education savings ' +
    'account. Titled "Form 5498-ESA" and "Coverdell ESA Contribution ' +
    'Information". Distinct from Form 5498 (an IRA) and from Form 1099-Q, which ' +
    'reports money coming out rather than going in.',
  fields: {
    trustee_name: {
      label: 'Trustee name',
      type: 'string',
      description:
        'The bank or broker holding the Coverdell account, from the TRUSTEE\'S ' +
        'name block.',
    },
    trustee_tin: {
      label: "Trustee's TIN",
      type: 'string',
      description: "The trustee's federal tax ID number.",
    },
    beneficiary_name: {
      label: 'Beneficiary name',
      type: 'string',
      person: true,
      description:
        'The child the account is for — the designated beneficiary, as printed.',
    },
    beneficiary_tin: {
      label: "Beneficiary's TIN",
      type: 'string',
      description:
        "The beneficiary's SSN. Often masked except for the last four digits — " +
        'record exactly what is printed.',
    },
    box_1_coverdell_esa_contributions: {
      label: 'Box 1: Coverdell ESA contributions',
      type: 'number',
      description:
        'Contributions made to the account for the year, from Box 1. Capped at ' +
        '$2,000 per beneficiary across all contributors.',
    },
    box_2_rollover_contributions: {
      label: 'Box 2: Rollover contributions',
      type: 'number',
      description:
        'Amounts rolled in from another Coverdell, from Box 2. Not a new ' +
        'contribution and not subject to the annual cap.',
    },
    account_number: {
      label: 'Account number',
      type: 'string',
      description: 'The Coverdell account number.',
    },
    tax_year: {
      label: 'Tax year',
      type: 'number',
      description:
        'The tax year the contributions are for, as a four-digit year (e.g. ' +
        '2024). Note this form arrives the April *after* that year.',
    },
  },
};

export default form5498Esa;
