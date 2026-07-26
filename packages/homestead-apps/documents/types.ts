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
  // Scalars for simple types; arrays/objects once a type declares composite
  // fields (e.g. a recipe's ingredient list). Narrow per doc type at the use
  // site — the shape is only known against the matched type's declared fields.
  [field: string]: unknown;
}

export interface Document {
  id: string;
  path: string;
  title?: string;
  /** True once a human edits the title; stops classify from overwriting it. */
  title_edited?: boolean;
  /** Presence marker on read, not a usable URL — fetch bytes via `download`. */
  file?: string;
  mime_type?: string;
  /** Extracted text, filled by the platform index pipeline. */
  file_text?: string;
  /** @deprecated Legacy field; read only during the file_text backfill. */
  full_text?: string;
  parse_status?: ParseStatus;
  confidence?: number;
  metadata?: DocumentMetadata;
  /**
   * Path of the resource a `post_classify` hook created from this document
   * (e.g. `hsa-receipts/abc`). Its presence also stops a re-classify from
   * creating a duplicate.
   */
  linked_resource?: string;
  created_by?: string;
  /** Provider message id this doc was ingested from (email source only). */
  source_email_id?: string;
  /** Per-message attachment key `"{index}:{filename}"` for email-ingested docs. */
  source_email_attachment?: string;
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
