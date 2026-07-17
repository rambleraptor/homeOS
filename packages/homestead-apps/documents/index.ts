export { documentsApp } from './app.config';
export { documentsResources, DOCUMENTS, DOC_TYPE_FIELD, PARSE_STATUSES } from './resources';
export type { ParseStatus } from './resources';
export type { Document, DocumentMetadata, ClassifyResult } from './types';
export {
  mergeDocTypes,
  parseDocType,
  toVariants,
  toZodUnion,
  UNKNOWN_DOC_TYPE,
} from './doc-types/docType';
export type { DocType, DocField, DocFieldType } from './doc-types/docType';
export {
  getDocType,
  getDocTypes,
  initializeDocTypes,
  resetDocTypes,
} from './doc-types/registry';
