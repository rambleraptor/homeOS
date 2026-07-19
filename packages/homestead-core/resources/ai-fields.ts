/**
 * Shared helpers for AI-processed file fields (`FieldDef.ai`).
 *
 * A file field can opt into text extraction and/or embedding. The (record,
 * field) pair — not the record — is the unit of extraction, embedding, status,
 * and citation, so everything here is keyed by field name. These predicates are
 * the single source of truth shared by the translator (companion synthesis),
 * the gateway (upload auto-trigger), the index-file method, and the chat search
 * tool, so they can't drift apart.
 */

import type { EmbedOptions, FieldDef, ResourceDefinition } from './types';

/** Instance defaults when a field opts into `embed: true` without options. */
export const DEFAULT_CHUNK_SIZE = 1000;
export const DEFAULT_OVERLAP = 150;

/** Companion field that holds a file field's extracted text: `file` → `file_text`. */
export function companionTextField(fileFieldName: string): string {
  return `${fileFieldName}_text`;
}

/**
 * Does this field extract text? True when it's a file field with
 * `ai.extract_text` or `ai.embed` (embedding implies extraction).
 */
export function fileExtractsText(field: FieldDef): boolean {
  const ai = field.ai;
  return field.type === 'file' && !!ai && (!!ai.extract_text || !!ai.embed);
}

/** Does this field embed its extracted text into the vector index? */
export function fileEmbeds(field: FieldDef): boolean {
  return field.type === 'file' && !!field.ai?.embed;
}

/**
 * Resolved chunk/overlap/model for an embedded field, with instance defaults
 * applied. Returns null when the field doesn't embed. `embedding_model` is the
 * empty string when the field doesn't override the instance-wide model.
 */
export function resolveEmbedOptions(field: FieldDef): Required<EmbedOptions> | null {
  if (!fileEmbeds(field)) return null;
  const opts: EmbedOptions =
    typeof field.ai!.embed === 'object' ? field.ai!.embed : {};
  return {
    chunk_size: opts.chunk_size ?? DEFAULT_CHUNK_SIZE,
    overlap: opts.overlap ?? DEFAULT_OVERLAP,
    embedding_model: opts.embedding_model ?? '',
  };
}

/** The AI file fields on a resource, as `[fieldName, field]` pairs. */
export function aiFileFields(def: ResourceDefinition): Array<[string, FieldDef]> {
  return Object.entries(def.fields).filter(([, f]) => fileExtractsText(f));
}
