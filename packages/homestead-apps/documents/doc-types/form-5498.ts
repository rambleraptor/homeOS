/**
 * Form 5498 — IRA contribution information.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. This form
 * names a TRUSTEE/ISSUER and a PARTICIPANT.
 */

import type { DocType } from './docType';

const form5498: DocType = {
  id: 'form-5498',
  label: 'Form 5498',
  icon: () => import('lucide-react').then((m) => m.Vault),
  category: 'tax',
  title_template: '5498 ({tax_year}) — {trustee_name}',
  description:
    'A US tax form reporting contributions to an IRA during the year, plus its ' +
    'year-end value. Titled "Form 5498" and "IRA Contribution Information", issued ' +
    'by the IRA trustee or custodian. Distinct from Form 5498-SA (HSA/MSA).',
  fields: {
    trustee_name: {
      label: 'Trustee name',
      type: 'string',
      description: "The IRA trustee, custodian, or issuer, from the TRUSTEE'S name block.",
    },
    trustee_tin: {
      label: "Trustee's TIN",
      type: 'string',
      description: "The trustee's federal tax ID number.",
    },
    participant_name: {
      label: 'Participant name',
      type: 'string',
      person: true,
      description: 'The IRA owner (participant), as printed on the form.',
    },
    participant_tin: {
      label: "Participant's TIN",
      type: 'string',
      description:
        "The participant's SSN or taxpayer ID, often masked except for the last four digits.",
    },
    box_1_ira_contributions: {
      label: 'Box 1: IRA contributions',
      type: 'number',
      description:
        'Traditional IRA contributions made for the year (not rollovers), from Box 1.',
    },
    box_2_rollover_contributions: {
      label: 'Box 2: Rollover contributions',
      type: 'number',
      description: 'Rollover contributions received, from Box 2.',
    },
    box_5_fair_market_value: {
      label: 'Box 5: Fair market value of account',
      type: 'number',
      description: 'The account\'s fair market value at year end, from Box 5.',
    },
    box_10_roth_ira_contributions: {
      label: 'Box 10: Roth IRA contributions',
      type: 'number',
      description: 'Roth IRA contributions made for the year, from Box 10.',
    },
    ira_type: {
      label: 'IRA type',
      type: 'string',
      description:
        'Which IRA-type box is checked in Box 7 — e.g. "IRA", "SEP", "SIMPLE", or ' +
        '"Roth IRA". Record the checked type.',
    },
  },
};

export default form5498;
