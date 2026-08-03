/**
 * Form 1098-T — tuition statement.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. This form
 * names a FILER (the school) and a STUDENT.
 */

import type { DocType } from './docType';

const form1098T: DocType = {
  id: 'form-1098-t',
  label: 'Form 1098-T',
  icon: () => import('lucide-react').then((m) => m.School),
  category: 'tax',
  title_template: '1098-T ({tax_year}) — {filer_name}',
  description:
    'A US tax form reporting tuition a student was billed or paid during the year. ' +
    'Titled "Form 1098-T" and "Tuition Statement", issued by a college or university. ' +
    'Distinct from Form 1098 (mortgage) and 1098-E (student loan interest).',
  fields: {
    filer_name: {
      label: 'School name',
      type: 'string',
      description: "The college or university that filed the form, from the FILER'S name block.",
    },
    filer_tin: {
      label: "Filer's TIN",
      type: 'string',
      description: "The school's federal tax ID number, labelled FILER'S TIN.",
    },
    student_name: {
      label: 'Student name',
      type: 'string',
      person: true,
      description: 'The student the tuition was for, as printed on the form.',
    },
    student_tin: {
      label: "Student's TIN",
      type: 'string',
      description:
        "The student's SSN or taxpayer ID, often masked except for the last four digits.",
    },
    box_1_payments_received: {
      label: 'Box 1: Payments received for qualified tuition',
      type: 'number',
      description: 'Payments received for qualified tuition and related expenses, from Box 1.',
    },
    box_4_adjustments: {
      label: 'Box 4: Adjustments for a prior year',
      type: 'number',
      description: 'Adjustments made for a prior year, from Box 4.',
    },
    box_5_scholarships_grants: {
      label: 'Box 5: Scholarships or grants',
      type: 'number',
      description: 'Scholarships or grants administered by the school, from Box 5.',
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

export default form1098T;
