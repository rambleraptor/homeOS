/**
 * Form 1099-C — cancellation of debt.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. This form
 * names a CREDITOR and a DEBTOR, not payer/recipient.
 */

import type { DocType } from './docType';

const form1099C: DocType = {
  id: 'form-1099-c',
  label: 'Form 1099-C',
  icon: () => import('lucide-react').then((m) => m.Eraser),
  category: 'tax',
  title_template: '1099-C ({tax_year}) — {creditor_name}',
  description:
    'A US tax form reporting a debt a lender cancelled or forgave. Titled "Form ' +
    '1099-C" and "Cancellation of Debt", with a CREDITOR and a DEBTOR block. ' +
    'Cancelled debt is often taxable income to the debtor.',
  fields: {
    creditor_name: {
      label: 'Creditor name',
      type: 'string',
      description: "The lender that cancelled the debt, from the CREDITOR'S name block.",
    },
    creditor_tin: {
      label: "Creditor's TIN",
      type: 'string',
      description: "The creditor's federal tax ID number, labelled CREDITOR'S TIN.",
    },
    debtor_name: {
      label: 'Debtor name',
      type: 'string',
      person: true,
      description: 'The borrower whose debt was cancelled, as printed on the form.',
    },
    debtor_tin: {
      label: "Debtor's TIN",
      type: 'string',
      description:
        "The debtor's SSN or taxpayer ID, often masked except for the last four digits.",
    },
    date_of_identifiable_event: {
      label: 'Box 1: Date of identifiable event',
      type: 'string',
      description: 'The date the debt was treated as cancelled, from Box 1. As printed.',
    },
    box_2_amount_of_debt_discharged: {
      label: 'Box 2: Amount of debt discharged',
      type: 'number',
      description: 'The amount of debt cancelled, from Box 2.',
    },
    box_3_interest_included: {
      label: 'Box 3: Interest included in Box 2',
      type: 'number',
      description: 'The portion of Box 2 that was interest, from Box 3.',
    },
    debt_description: {
      label: 'Box 4: Debt description',
      type: 'string',
      description: 'A description of the debt (e.g. "credit card"), from Box 4.',
    },
    box_7_fair_market_value: {
      label: 'Box 7: Fair market value of property',
      type: 'number',
      description:
        'For a foreclosure or abandonment, the property\'s fair market value, from Box 7.',
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

export default form1099C;
