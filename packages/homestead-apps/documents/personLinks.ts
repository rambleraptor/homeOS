/**
 * Resolve a document's *derived* people to stored `person` ids.
 *
 * A document's people are extracted as free-text names by each doc type
 * (`getDocumentPeople`); the stored `people` link needs directory ids instead.
 * This walks the derived names, resolves each through the People directory
 * (`matchPersonByName`, alias- and token-subset aware), and returns the distinct
 * ids of the people it could confidently match — dropping any name the directory
 * doesn't know or matches ambiguously. Empty when the document names no one, or
 * none of the names resolve.
 *
 * Pure and dependency-free (no client, no fetch), so it's shared by both writers
 * of the link: `classify` (seed-if-empty on upload) and the one-shot backfill
 * migration. Callers supply the directory they've already loaded.
 */

import { getDocumentPeople } from './doc-types/people';
import { matchPersonByName } from '../people/utils/matchPerson';
import type { Person } from '../people/types';
import type { Document } from './types';

export function resolveDocumentPersonIds(doc: Document, people: Person[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const name of getDocumentPeople(doc)) {
    const match = matchPersonByName(name, people, { tokenSubset: true });
    if (match && !seen.has(match.id)) {
      seen.add(match.id);
      ids.push(match.id);
    }
  }
  return ids;
}
