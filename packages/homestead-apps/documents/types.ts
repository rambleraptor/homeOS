import type { ParseStatus } from './resources';
import type { UNKNOWN_DOC_TYPE } from './doc-types/docType';

/**
 * Metadata parsed from a document.
 *
 * A tagged union at the wire level, but the variants come from operator YAML, so
 * there's no static type to name them: `doc_type` is known, the rest is looked
 * up against the doc type's declared fields (see `getDocType`). The UI renders
 * fields from that declaration rather than from a hand-written interface, which
 * is what lets a new YAML file work with no code change.
 */
export interface DocumentMetadata {
  doc_type: string | typeof UNKNOWN_DOC_TYPE;
  [field: string]: string | number | undefined;
}

export interface Document {
  id: string;
  path: string;
  title?: string;
  /** Presence marker on read, not a usable URL — fetch bytes via `download`. */
  file?: string;
  mime_type?: string;
  full_text?: string;
  parse_status?: ParseStatus;
  confidence?: number;
  metadata?: DocumentMetadata;
  created_by?: string;
  create_time?: string;
  update_time?: string;
}

/** The classify method's operation response. */
export interface ClassifyResult {
  doc_type: string;
  confidence: number;
  parse_status: ParseStatus;
  message: string;
}
