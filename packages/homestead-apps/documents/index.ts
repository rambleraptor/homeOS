export { documentsApp } from './app.config';
export { RedactionEditor } from './redaction/RedactionEditor';
export { buildRedactedFile } from './redaction/redact';
export type { NormRect, PageRaster } from './redaction/types';
export { documentsResources, DOCUMENTS, DOC_TYPE_FIELD, PARSE_STATUSES } from './resources';
export type { ParseStatus } from './resources';
export type { Document, DocumentMetadata, ClassifyResult } from './types';
export {
  validateDocType,
  toVariants,
  docTypeIds,
  toExtractionSchema,
  UNKNOWN_DOC_TYPE,
} from './doc-types/docType';
export { BUILTIN_DOC_TYPES } from './doc-types/builtins';
export type { DocType, DocField, DocFieldType } from './doc-types/docType';
export { getDocType, getDocTypes } from './doc-types/registry';
