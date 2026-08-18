/**
 * Form 1099-Q — distributions from a 529 plan or Coverdell ESA.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply.
 *
 * The companion to Form 1098-T: the 1098-T says what the school was paid, the
 * 1099-Q says what came out of the education account to pay it, and the two are
 * read together to work out how much of the distribution is taxable.
 */

import type { DocType } from './docType';

const form1099Q: DocType = {
  id: 'form-1099-q',
  label: 'Form 1099-Q',
  icon: () => import('lucide-react').then((m) => m.GraduationCap),
  category: 'tax',
  title_template: '1099-Q ({tax_year}) — {payer_name}',
  description:
    'A US tax form reporting money withdrawn from a qualified education savings ' +
    'account — a 529 plan or a Coverdell ESA. Titled "Form 1099-Q" and "Payments ' +
    'From Qualified Education Programs (Under Sections 529 and 530)". Distinct ' +
    'from Form 1098-T, which reports tuition billed by a school.',
  fields: {
    payer_name: {
      label: 'Payer / trustee name',
      type: 'string',
      description:
        'The 529 plan or ESA trustee that made the distribution, from the ' +
        "PAYER'S/TRUSTEE'S name block, top left.",
    },
    payer_tin: {
      label: "Payer's TIN",
      type: 'string',
      description: "The payer's or trustee's federal tax ID number.",
    },
    recipient_name: {
      label: 'Recipient name',
      type: 'string',
      person: true,
      description:
        'The person the distribution was paid to — the account owner or the ' +
        'designated beneficiary, whoever received it.',
    },
    recipient_tin: {
      label: "Recipient's TIN",
      type: 'string',
      description:
        "The recipient's SSN or taxpayer ID. Often masked except for the last " +
        'four digits — record exactly what is printed.',
    },
    box_1_gross_distribution: {
      label: 'Box 1: Gross distribution',
      type: 'number',
      description:
        'The total distributed from the account during the year, from Box 1. ' +
        'Equals Box 2 plus Box 3.',
    },
    box_2_earnings: {
      label: 'Box 2: Earnings',
      type: 'number',
      description:
        'The earnings portion of the distribution, from Box 2. The only part that ' +
        'can be taxable, and only when the distribution exceeds qualified expenses.',
    },
    box_3_basis: {
      label: 'Box 3: Basis',
      type: 'number',
      description:
        'The contributions portion of the distribution, from Box 3. Never taxable ' +
        '— it is money that was already taxed going in.',
    },
    account_number: {
      label: 'Account number',
      type: 'string',
      description: 'The education account number the distribution came from.',
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

export default form1099Q;
