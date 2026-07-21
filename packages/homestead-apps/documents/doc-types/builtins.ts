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
import form1099Int from './form-1099-int';
import formW2 from './form-w2';
import medicalReceipt from './medical-receipt';
import recipe from './recipe';

export const BUILTIN_DOC_TYPES: DocType[] = [
  form1099Int,
  formW2,
  medicalReceipt,
  recipe,
];
