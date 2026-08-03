/**
 * Form 1099-DIV — dividends and distributions.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Field
 * descriptions say which numbered box a value comes from so the model doesn't
 * confuse neighbouring boxes.
 */

import type { DocType } from './docType';

const form1099Div: DocType = {
  id: 'form-1099-div',
  label: 'Form 1099-DIV',
  icon: () => import('lucide-react').then((m) => m.Coins),
  category: 'tax',
  title_template: '1099-DIV ({tax_year}) — {payer_name}',
  description:
    'A US tax form reporting dividends and other distributions paid on stock ' +
    'during the year. Titled "Form 1099-DIV" and "Dividends and Distributions", ' +
    'with numbered boxes (1a-12). Issued by a brokerage, fund, or company.',
  fields: {
    payer_name: {
      label: 'Payer name',
      type: 'string',
      description:
        "The brokerage, fund, or company that paid the dividends, from the PAYER'S " +
        'name block, top left. Name only, not the address.',
    },
    payer_tin: {
      label: "Payer's TIN",
      type: 'string',
      description: "The payer's federal tax ID number, labelled PAYER'S TIN.",
    },
    recipient_name: {
      label: 'Recipient name',
      type: 'string',
      person: true,
      description: 'The shareholder the dividends were paid to, as printed on the form.',
    },
    recipient_tin: {
      label: "Recipient's TIN",
      type: 'string',
      description:
        "The recipient's SSN or taxpayer ID, often masked except for the last four " +
        'digits — record exactly what is printed, masking included.',
    },
    box_1a_ordinary_dividends: {
      label: 'Box 1a: Total ordinary dividends',
      type: 'number',
      description: 'Total ordinary dividends, from Box 1a. Includes the Box 1b amount.',
    },
    box_1b_qualified_dividends: {
      label: 'Box 1b: Qualified dividends',
      type: 'number',
      description:
        'The portion of Box 1a taxed at the lower capital-gains rate, from Box 1b. ' +
        'A subset of Box 1a, not an addition to it.',
    },
    box_2a_total_capital_gain_distr: {
      label: 'Box 2a: Total capital gain distributions',
      type: 'number',
      description: 'Total capital gain distributions, from Box 2a.',
    },
    box_3_nondividend_distributions: {
      label: 'Box 3: Nondividend distributions',
      type: 'number',
      description: 'Return-of-capital distributions, from Box 3. Generally not taxable.',
    },
    box_4_federal_tax_withheld: {
      label: 'Box 4: Federal income tax withheld',
      type: 'number',
      description: 'Federal income tax withheld, from Box 4. Usually backup withholding.',
    },
    box_7_foreign_tax_paid: {
      label: 'Box 7: Foreign tax paid',
      type: 'number',
      description: 'Foreign tax paid on the dividends, from Box 7. Often creditable.',
    },
  },
};

export default form1099Div;
