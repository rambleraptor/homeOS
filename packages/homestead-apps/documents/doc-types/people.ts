/**
 * Derive the people named on a document.
 *
 * People aren't a stored field — each doc type already extracts them into its
 * own metadata columns (a medical receipt's `patient`, a W-2's `employee_name`,
 * an auto policy's `covered_drivers`, ...). The doc type flags those columns
 * with `person: true` (see {@link DocField.person}); this walks a document's
 * metadata against its type's declaration and collects whatever sits in the
 * flagged leaves. That keeps the "filter by person" facet generic: a new
 * person-bearing doc type joins it just by marking a field, with no code here.
 */

import type { DocField } from './docType';
import { getDocType } from './registry';
import type { Document } from '../types';

/** Walk one (field, value) pair, pushing any person names it holds into `out`. */
function collectFromField(field: DocField, value: unknown, out: string[]): void {
  if (value === null || value === undefined) return;

  if (field.type === 'array' && field.items && Array.isArray(value)) {
    for (const element of value) collectFromField(field.items, element, out);
    return;
  }

  if (field.type === 'object' && field.properties && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const [name, sub] of Object.entries(field.properties)) {
      collectFromField(sub, record[name], out);
    }
    return;
  }

  if (field.person && field.type === 'string' && typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) out.push(trimmed);
  }
}

/**
 * The distinct people named on a document, in first-seen order. Deduplicated
 * case-insensitively (so "Jane Doe" and "jane doe" collapse) but keeping the
 * first spelling seen for display. Empty when the document is unparsed, matched
 * no type, or its type names no people.
 */
export function getDocumentPeople(doc: Document): string[] {
  const metadata = doc.metadata;
  if (!metadata) return [];
  const docType = getDocType(metadata.doc_type);
  if (!docType) return [];

  const names: string[] = [];
  for (const [name, field] of Object.entries(docType.fields)) {
    collectFromField(field, metadata[name], names);
  }

  const seen = new Set<string>();
  const distinct: string[] = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    distinct.push(name);
  }
  return distinct;
}
