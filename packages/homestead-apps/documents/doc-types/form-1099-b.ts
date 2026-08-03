/**
 * Form 1099-B — proceeds from broker and barter exchange transactions.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply.
 */

import type { DocType } from './docType';

const form1099B: DocType = {
  id: 'form-1099-b',
  label: 'Form 1099-B',
  icon: () => import('lucide-react').then((m) => m.TrendingUp),
  category: 'tax',
  title_template: '1099-B ({tax_year}) — {payer_name}',
  description:
    'A US tax form reporting proceeds from securities a broker sold during the ' +
    'year. Titled "Form 1099-B" and "Proceeds From Broker and Barter Exchange ' +
    'Transactions", with numbered boxes and per-lot rows of dates and amounts.',
  fields: {
    payer_name: {
      label: 'Payer name',
      type: 'string',
      description: "The broker that executed the sales, from the PAYER'S name block.",
    },
    payer_tin: {
      label: "Payer's TIN",
      type: 'string',
      description: "The broker's federal tax ID number, labelled PAYER'S TIN.",
    },
    recipient_name: {
      label: 'Recipient name',
      type: 'string',
      person: true,
      description: 'The account holder the proceeds were paid to, as printed on the form.',
    },
    recipient_tin: {
      label: "Recipient's TIN",
      type: 'string',
      description:
        "The recipient's SSN or taxpayer ID, often masked except for the last four " +
        'digits — record exactly what is printed.',
    },
    description_of_property: {
      label: 'Box 1a: Description of property',
      type: 'string',
      description:
        'What was sold, from Box 1a — e.g. "100 sh XYZ". When several lots are ' +
        'listed, take the first, or a short summary.',
    },
    date_acquired: {
      label: 'Box 1b: Date acquired',
      type: 'string',
      description: 'The date the security was bought, from Box 1b. As printed.',
    },
    date_sold: {
      label: 'Box 1c: Date sold or disposed',
      type: 'string',
      description: 'The date the security was sold, from Box 1c. As printed.',
    },
    box_1d_proceeds: {
      label: 'Box 1d: Proceeds',
      type: 'number',
      description: 'Gross proceeds from the sale, from Box 1d.',
    },
    box_1e_cost_basis: {
      label: 'Box 1e: Cost or other basis',
      type: 'number',
      description: 'The cost basis of the security sold, from Box 1e.',
    },
    box_1g_wash_sale_loss_disallowed: {
      label: 'Box 1g: Wash sale loss disallowed',
      type: 'number',
      description: 'Loss disallowed under the wash-sale rule, from Box 1g.',
    },
    box_4_federal_tax_withheld: {
      label: 'Box 4: Federal income tax withheld',
      type: 'number',
      description: 'Federal income tax withheld, from Box 4. Usually zero.',
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

export default form1099B;
