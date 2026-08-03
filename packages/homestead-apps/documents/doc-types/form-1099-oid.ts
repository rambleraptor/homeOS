/**
 * Form 1099-OID — original issue discount.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply.
 */

import type { DocType } from './docType';

const form1099Oid: DocType = {
  id: 'form-1099-oid',
  label: 'Form 1099-OID',
  icon: () => import('lucide-react').then((m) => m.Percent),
  category: 'tax',
  title_template: '1099-OID ({tax_year}) — {payer_name}',
  description:
    'A US tax form reporting original issue discount — the interest that accrues ' +
    'on a bond issued below face value. Titled "Form 1099-OID" and "Original Issue ' +
    'Discount", issued by a broker or the bond issuer.',
  fields: {
    payer_name: {
      label: 'Payer name',
      type: 'string',
      description: "The issuer or broker that reported the OID, from the PAYER'S block.",
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
      description: 'The bondholder the OID was reported for, as printed on the form.',
    },
    recipient_tin: {
      label: "Recipient's TIN",
      type: 'string',
      description:
        "The recipient's SSN or taxpayer ID, often masked except for the last four digits.",
    },
    box_1_original_issue_discount: {
      label: 'Box 1: Original issue discount',
      type: 'number',
      description: 'OID for the year on the obligation, from Box 1.',
    },
    box_2_other_periodic_interest: {
      label: 'Box 2: Other periodic interest',
      type: 'number',
      description: 'Stated interest paid separately from the OID, from Box 2.',
    },
    box_4_federal_tax_withheld: {
      label: 'Box 4: Federal income tax withheld',
      type: 'number',
      description: 'Federal income tax withheld, from Box 4. Usually backup withholding.',
    },
    box_8_oid_on_treasury: {
      label: 'Box 8: OID on U.S. Treasury obligations',
      type: 'number',
      description:
        'OID on Treasury obligations, from Box 8. Often exempt from state tax; ' +
        'distinct from Box 1.',
    },
  },
};

export default form1099Oid;
