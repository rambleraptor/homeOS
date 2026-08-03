/**
 * Form 1098-E — student loan interest statement.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply.
 */

import type { DocType } from './docType';

const form1098E: DocType = {
  id: 'form-1098-e',
  label: 'Form 1098-E',
  icon: () => import('lucide-react').then((m) => m.GraduationCap),
  category: 'tax',
  title_template: '1098-E ({tax_year}) — {lender_name}',
  description:
    'A US tax form reporting student loan interest a borrower paid during the year. ' +
    'Titled "Form 1098-E" and "Student Loan Interest Statement", issued by the loan ' +
    'servicer. Distinct from Form 1098 (mortgage) and 1098-T (tuition).',
  fields: {
    lender_name: {
      label: 'Lender name',
      type: 'string',
      description:
        "The loan servicer or lender that received the interest, from the RECIPIENT'S/" +
        "LENDER'S name block.",
    },
    lender_tin: {
      label: "Lender's TIN",
      type: 'string',
      description: "The lender's federal tax ID number.",
    },
    borrower_name: {
      label: 'Borrower name',
      type: 'string',
      person: true,
      description: 'The borrower who paid the interest, from the BORROWER block.',
    },
    borrower_tin: {
      label: "Borrower's TIN",
      type: 'string',
      description:
        "The borrower's SSN or taxpayer ID, often masked except for the last four digits.",
    },
    box_1_student_loan_interest: {
      label: 'Box 1: Student loan interest received',
      type: 'number',
      description: 'Student loan interest received by the lender during the year, from Box 1.',
    },
  },
};

export default form1098E;
