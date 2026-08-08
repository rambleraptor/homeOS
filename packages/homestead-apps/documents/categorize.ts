/**
 * Group documents by their doc type's `category` (e.g. tax, medical).
 *
 * A doc type may declare a `category` describing the *kind* of document it is
 * (every tax form shares `tax`); most types declare none. This buckets a list of
 * documents by that category — anything uncategorized, unrecognized, or unparsed
 * falls into a single trailing "Other" group. Named categories sort
 * alphabetically; "Other" always sorts last so it reads as the catch-all.
 *
 * Used by the person detail page to present someone's documents in sections
 * rather than one flat list. Kept here (not in the People app) so it travels with
 * the doc-type registry it reads.
 */

import { getDocType } from './doc-types/registry';
import type { Document } from './types';

/** The bucket key + label for documents whose type has no category. */
const OTHER_KEY = 'other';
const OTHER_LABEL = 'Other';

export interface DocumentCategoryGroup {
  /** The doc-type category (e.g. `tax`), or `other` for the catch-all bucket. */
  key: string;
  /** Display label, e.g. `Tax`, `Medical`, `Other`. */
  label: string;
  /** Documents in this category, in the input order (already sorted upstream). */
  documents: Document[];
}

/** `tax` → `Tax`. Categories are lowercase kebab-case; just cap the first letter. */
function categoryLabel(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Bucket `documents` by doc-type category. Preserves input order within each
 * group, sorts named categories alphabetically by label, and always places the
 * `Other` bucket last. Categories with no documents never appear.
 */
export function groupDocumentsByCategory(documents: Document[]): DocumentCategoryGroup[] {
  const byKey = new Map<string, Document[]>();
  for (const doc of documents) {
    const type = doc.metadata?.doc_type ? getDocType(doc.metadata.doc_type) : undefined;
    const key = type?.category ?? OTHER_KEY;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(doc);
    else byKey.set(key, [doc]);
  }

  return [...byKey.entries()]
    .map(([key, docs]): DocumentCategoryGroup => ({
      key,
      label: key === OTHER_KEY ? OTHER_LABEL : categoryLabel(key),
      documents: docs,
    }))
    .sort((a, b) => {
      if (a.key === OTHER_KEY) return 1;
      if (b.key === OTHER_KEY) return -1;
      return a.label.localeCompare(b.label);
    });
}
