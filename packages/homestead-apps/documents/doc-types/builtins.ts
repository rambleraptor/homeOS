/**
 * The doc types shipped with the app.
 *
 * An explicit list rather than a glob so both loaders can share it: the SPA
 * globs Vite modules, the server can't, but both merge these builtins with the
 * operator's project overrides. Add a builtin by writing its module next to
 * this one and adding it here — the operator adds their own by dropping a
 * module into `<project>/documents/types/` (no code change).
 */

import type { DocType } from './docType';
import advanceDirective from './advance-directive';
import afterVisitSummary from './after-visit-summary';
import applianceManual from './appliance-manual';
import autoInsurancePolicy from './auto-insurance-policy';
import charitableDonationReceipt from './charitable-donation-receipt';
import childcareProviderStatement from './childcare-provider-statement';
import closingDisclosure from './closing-disclosure';
import dischargeSummary from './discharge-summary';
import doctorNote from './doctor-note';
import estimatedTaxPayment from './estimated-tax-payment';
import explanationOfBenefits from './explanation-of-benefits';
import form1040 from './form-1040';
import form1095A from './form-1095-a';
import form1095B from './form-1095-b';
import form1095C from './form-1095-c';
import form1098 from './form-1098';
import form1098E from './form-1098-e';
import form1098T from './form-1098-t';
import form1099B from './form-1099-b';
import form1099C from './form-1099-c';
import form1099Da from './form-1099-da';
import form1099Div from './form-1099-div';
import form1099G from './form-1099-g';
import form1099Int from './form-1099-int';
import form1099K from './form-1099-k';
import form1099Misc from './form-1099-misc';
import form1099Nec from './form-1099-nec';
import form1099Oid from './form-1099-oid';
import form1099Q from './form-1099-q';
import form1099R from './form-1099-r';
import form1099S from './form-1099-s';
import form1099Sa from './form-1099-sa';
import form5498 from './form-5498';
import form5498Esa from './form-5498-esa';
import form5498Sa from './form-5498-sa';
import formSsa1099 from './form-ssa-1099';
import formW2 from './form-w2';
import formW2G from './form-w-2g';
import healthInsuranceCard from './health-insurance-card';
import homeInsurancePolicy from './home-insurance-policy';
import immunizationRecord from './immunization-record';
import labResult from './lab-result';
import medicalBill from './medical-bill';
import medicalReceipt from './medical-receipt';
import prescription from './prescription';
import propertyTaxStatement from './property-tax-statement';
import recipe from './recipe';
import scheduleK1 from './schedule-k-1';
import visionPrescription from './vision-prescription';
import warranty from './warranty';

export const BUILTIN_DOC_TYPES: DocType[] = [
  // Home / household documents (category "home").
  autoInsurancePolicy,
  homeInsurancePolicy,
  applianceManual,
  warranty,
  recipe,
  // Personal medical/health documents (category "medical").
  medicalReceipt,
  medicalBill,
  explanationOfBenefits,
  healthInsuranceCard,
  immunizationRecord,
  labResult,
  prescription,
  visionPrescription,
  afterVisitSummary,
  doctorNote,
  dischargeSummary,
  advanceDirective,
  // Personal tax documents (category "tax").
  form1040,
  form1095A,
  form1095B,
  form1095C,
  form1098,
  form1098E,
  form1098T,
  form1099B,
  form1099C,
  form1099Da,
  form1099Div,
  form1099G,
  form1099Int,
  form1099K,
  form1099Misc,
  form1099Nec,
  form1099Oid,
  form1099Q,
  form1099R,
  form1099S,
  form1099Sa,
  form5498,
  form5498Esa,
  form5498Sa,
  formSsa1099,
  formW2,
  formW2G,
  propertyTaxStatement,
  scheduleK1,
  // Tax documents that aren't IRS forms — a charity's letter, a payment
  // confirmation, a settlement statement, a daycare's year-end summary. Filed
  // under "tax" for what they prove at filing time, not for who printed them.
  charitableDonationReceipt,
  estimatedTaxPayment,
  closingDisclosure,
  childcareProviderStatement,
];
