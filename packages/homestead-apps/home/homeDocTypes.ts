/**
 * Which document types the Home app surfaces.
 *
 * An explicit allow-list of doc-type ids, deliberately *not* a filter on the
 * doc type's `category`. Two of these types carry `category: 'home'`
 * (appliance-manual, warranty), but the others don't and can't: a homeowners
 * policy is uncategorised, and `property-tax-statement` is pinned to
 * `category: 'tax'` by a resource test even though it's a property document. A
 * document can only hold one category, so the Home app owns its own list rather
 * than borrowing the shared taxonomy.
 */

import type { Document } from '../documents/types';

/**
 * The doc-type ids shown in the Home app, in display order. Each must be a
 * declared doc type — `homeDocTypes.test.ts` fails if one is renamed or removed,
 * so a typo here can't silently empty the list.
 */
export const HOME_DOC_TYPE_IDS = [
  'appliance-manual',
  'warranty',
  'home-insurance-policy',
  'property-tax-statement',
] as const;

const HOME_DOC_TYPE_SET: ReadonlySet<string> = new Set(HOME_DOC_TYPE_IDS);

/**
 * Whether a document's matched type is one the Home app shows. A document that
 * matched no type (or is still being read) has no `doc_type` and is excluded.
 */
export function isHomeDocument(doc: Document): boolean {
  const id = doc.metadata?.doc_type;
  return id !== undefined && HOME_DOC_TYPE_SET.has(id);
}
