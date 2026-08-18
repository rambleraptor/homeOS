/**
 * Form 1095-C — an employer's offer of health coverage.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply.
 *
 * Shares `employer_name`/`employer_ein`/`employee_name`/`employee_ssn` with Form
 * W-2: the same employment relationship, reported on a second form.
 */

import type { DocType } from './docType';

const form1095C: DocType = {
  id: 'form-1095-c',
  label: 'Form 1095-C',
  icon: () => import('lucide-react').then((m) => m.BriefcaseMedical),
  category: 'tax',
  title_template: '1095-C ({tax_year}) — {employer_name}',
  description:
    'A US tax form recording the health coverage a large employer offered an ' +
    'employee, month by month. Titled "Form 1095-C" and "Employer-Provided ' +
    'Health Insurance Offer and Coverage", laid out with coded lines 14-17 ' +
    'across the months of the year. Distinct from Form 1095-B, which reports ' +
    'coverage actually held rather than coverage offered.',
  fields: {
    employee_name: {
      label: 'Employee name',
      type: 'string',
      person: true,
      description: 'The employee the offer was made to, from Part I.',
    },
    employee_ssn: {
      label: "Employee's SSN",
      type: 'string',
      description:
        "The employee's SSN, from Part I. Often masked except for the last four " +
        'digits — record exactly what is printed.',
    },
    employer_name: {
      label: 'Employer name',
      type: 'string',
      description: 'The employer that made the offer, from Part II.',
    },
    employer_ein: {
      label: "Employer's EIN",
      type: 'string',
      description: "The employer's Employer Identification Number, from Part II.",
    },
    lowest_cost_monthly_premium: {
      label: 'Employee required contribution',
      type: 'number',
      description:
        "The employee's share of the lowest-cost monthly premium, from line 15. " +
        'Often a single "All 12 Months" figure; take that one if so. Blank unless ' +
        'line 14 carries a code that requires it.',
    },
    coverage_months: {
      label: 'Months covered',
      type: 'string',
      description:
        'Which months coverage was offered or held, read from the line 14-16 ' +
        'month columns. Record "All 12 months" when the annual column is used, ' +
        'otherwise the months that apply.',
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

export default form1095C;
