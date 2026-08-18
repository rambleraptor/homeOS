/**
 * Form 1095-B — proof of minimum essential health coverage.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply.
 *
 * Informational for the federal return — the individual mandate penalty is $0 —
 * but several states (CA, MA, NJ, RI, and DC) run their own mandate and ask for
 * it, which is why it is worth filing rather than binning.
 */

import type { DocType } from './docType';

const form1095B: DocType = {
  id: 'form-1095-b',
  label: 'Form 1095-B',
  icon: () => import('lucide-react').then((m) => m.ShieldCheck),
  category: 'tax',
  title_template: '1095-B ({tax_year}) — {issuer_name}',
  description:
    'A US tax form confirming who had minimum essential health coverage and for ' +
    'which months. Titled "Form 1095-B" and "Health Coverage". Issued by an ' +
    'insurance company, a small employer\'s plan, or a government programme such ' +
    'as Medicaid. Distinct from Form 1095-A (a Marketplace plan) and Form 1095-C ' +
    '(a large employer\'s offer of coverage).',
  fields: {
    responsible_individual: {
      label: 'Responsible individual',
      type: 'string',
      person: true,
      description:
        'The person the policy is held by, from Part I. Usually the subscriber ' +
        'rather than every covered family member.',
    },
    responsible_individual_ssn: {
      label: "Responsible individual's SSN",
      type: 'string',
      description:
        'The SSN or TIN of the responsible individual, from Part I. Often masked ' +
        'except for the last four digits — record exactly what is printed.',
    },
    issuer_name: {
      label: 'Coverage provider',
      type: 'string',
      description:
        'The insurance company, employer plan, or government programme providing ' +
        'the coverage, from Part III.',
    },
    covered_individuals: {
      label: 'Covered individuals',
      type: 'array',
      description:
        'The people listed as covered, from Part IV. Names only, one per entry.',
      items: {
        label: 'Covered individual',
        type: 'string',
        person: true,
        description: "A covered person's name as printed in Part IV.",
      },
    },
    coverage_months: {
      label: 'Months covered',
      type: 'string',
      description:
        'Which months were covered, from the Part IV month boxes. Record "All 12 ' +
        'months" when that box is ticked, otherwise the months that are, e.g. ' +
        '"Jan–Jun".',
    },
    tax_year: {
      label: 'Tax year',
      type: 'number',
      description:
        'The tax year this form reports, as a four-digit year (e.g. 2024). ' +
        'Usually printed near the form title (often as "For calendar year ' +
        'YYYY") or in a corner of the form.',
    },
  },
};

export default form1095B;
