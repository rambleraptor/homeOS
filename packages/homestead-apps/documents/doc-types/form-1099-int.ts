/**
 * Form 1099-INT — interest income reported to the IRS.
 *
 * `description` and each field's `description` are handed to the model verbatim,
 * so they're written to disambiguate rather than to look tidy: they say where on
 * the form a value sits and what distinguishes it from a neighbouring box.
 *
 * Copy this file into your project's `documents/types/` to override it, or add a
 * new module there that default-exports a fresh `id` to teach the app another
 * document type.
 */

import type { DocType } from './docType';

const form1099Int: DocType = {
  id: 'form-1099-int',
  label: 'Form 1099-INT',
  icon: () => import('lucide-react').then((m) => m.Landmark),
  category: 'tax',
  title_template: '1099-INT ({tax_year}) — {payer_name}',
  description:
    'A US tax form reporting interest income paid to an account holder during ' +
    'the year. Titled "Form 1099-INT" and "Interest Income", with numbered ' +
    'boxes down the right-hand side. Issued by a bank, credit union, or brokerage.',
  fields: {
    payer_name: {
      label: 'Payer name',
      type: 'string',
      description:
        'The bank, credit union, or brokerage that paid the interest and issued ' +
        "the form. Appears in the PAYER'S name block, top left.",
    },
    payer_tin: {
      label: "Payer's TIN",
      type: 'string',
      description:
        'The payer\'s federal tax ID number, used by the IRS to match the form ' +
        "to the institution. Labelled PAYER'S TIN. Do not confuse it with the " +
        "recipient's TIN.",
    },
    recipient_name: {
      label: 'Recipient name',
      type: 'string',
      person: true,
      description:
        'The account holder the interest was paid to, as printed on the form.',
    },
    recipient_tin: {
      label: "Recipient's TIN",
      type: 'string',
      description:
        "The recipient's SSN or taxpayer ID. Usually masked except for the last " +
        'four digits (e.g. XXX-XX-1234) — record exactly what is printed, masking ' +
        'included.',
    },
    box_1_interest: {
      label: 'Box 1: Interest income',
      type: 'number',
      description:
        'Total taxable interest paid during the year, from Box 1. The figure ' +
        'reported on the tax return. A plain number, no currency symbol.',
    },
    box_2_early_withdrawal_penalty: {
      label: 'Box 2: Early withdrawal penalty',
      type: 'number',
      description:
        'Penalty charged for cashing out a CD early, from Box 2. Deductible as an ' +
        'adjustment to income.',
    },
    box_3_savings_bond_interest: {
      label: 'Box 3: U.S. Savings Bond / Treasury interest',
      type: 'number',
      description:
        'Interest on savings bonds and Treasury obligations, from Box 3. Often ' +
        'exempt from state tax. Distinct from Box 1.',
    },
    box_4_federal_tax_withheld: {
      label: 'Box 4: Federal income tax withheld',
      type: 'number',
      description:
        'Federal tax already withheld from the interest, from Box 4. Typically ' +
        'backup withholding, and usually zero.',
    },
    box_8_tax_exempt_interest: {
      label: 'Box 8: Tax-exempt interest',
      type: 'number',
      description:
        'Interest not subject to federal income tax, from Box 8, such as from ' +
        'municipal bond funds.',
    },
  },
};

export default form1099Int;
