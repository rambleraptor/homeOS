/**
 * Client-side filtering for the documents index.
 *
 * The list is fetched whole and sorted in the browser (aepbase has no sort
 * param; see `useDocuments`), so filtering happens here too rather than as a
 * server `filter` string — which also lets search reach the parsed metadata and
 * lets the person facet use the derived, unstored people list. All three
 * filters are pure functions of the already-loaded list, so they compose in one
 * `useMemo` with no extra fetch.
 */

import { getDocType } from './doc-types/registry';
import { UNKNOWN_DOC_TYPE } from './doc-types/docType';
import { getDocumentPeople } from './doc-types/people';
import type { Document } from './types';

/** The discriminator value the type facet uses for "matched no known type". */
export const UNRECOGNISED_TYPE = UNKNOWN_DOC_TYPE;

export interface DocumentFilters {
  /** Free-text search over title, type label, and parsed metadata values. */
  search: string;
  /** A doc type id, `UNRECOGNISED_TYPE`, or '' for "any type". */
  docType: string;
  /** A person's name (as it appears in `getDocumentPeople`), or '' for "anyone". */
  person: string;
}

export const EMPTY_FILTERS: DocumentFilters = { search: '', docType: '', person: '' };

/** Whether any filter is active — drives the "no matches" vs "empty" copy. */
export function hasActiveFilters(filters: DocumentFilters): boolean {
  return !!(filters.search.trim() || filters.docType || filters.person);
}

/** A type facet entry: the value stored on a document and its display label. */
export interface DocTypeFacet {
  value: string;
  label: string;
}

/**
 * The doc types actually present in the list, plus an "Unrecognised" entry when
 * some document matched none. Only surfacing types in use keeps the dropdown to
 * what's filterable — no empty options for types nobody has uploaded.
 */
export function collectDocTypeFacets(documents: Document[]): DocTypeFacet[] {
  const present = new Set<string>();
  for (const doc of documents) {
    const id = doc.metadata?.doc_type;
    if (id) present.add(id);
  }

  const facets: DocTypeFacet[] = [];
  for (const id of present) {
    if (id === UNRECOGNISED_TYPE) continue;
    const docType = getDocType(id);
    // A type still on record but no longer declared falls back to its raw id.
    facets.push({ value: id, label: docType?.label ?? id });
  }
  facets.sort((a, b) => a.label.localeCompare(b.label));

  // "Unrecognised" sorts last, after the named types.
  if (present.has(UNRECOGNISED_TYPE)) {
    facets.push({ value: UNRECOGNISED_TYPE, label: 'Unrecognised' });
  }
  return facets;
}

/**
 * Every person named across the documents, deduplicated case-insensitively and
 * sorted for a stable dropdown. Derived from metadata via `getDocumentPeople`,
 * never stored.
 */
export function collectPeople(documents: Document[]): string[] {
  const seen = new Map<string, string>();
  for (const doc of documents) {
    for (const person of getDocumentPeople(doc)) {
      const key = person.toLowerCase();
      if (!seen.has(key)) seen.set(key, person);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** The searchable text of a document: its title, type label, and metadata values. */
function searchableText(doc: Document): string {
  const parts: string[] = [];
  if (doc.title) parts.push(doc.title);

  const id = doc.metadata?.doc_type;
  if (id && id !== UNRECOGNISED_TYPE) {
    parts.push(getDocType(id)?.label ?? id);
  }

  if (doc.metadata) {
    for (const [key, value] of Object.entries(doc.metadata)) {
      if (key === 'doc_type') continue;
      collectSearchStrings(value, parts);
    }
  }
  return parts.join('\n').toLowerCase();
}

/** Flatten a metadata value (scalar, array, or nested object) to its strings. */
function collectSearchStrings(value: unknown, out: string[]): void {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    for (const element of value) collectSearchStrings(element, out);
  } else if (typeof value === 'object') {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectSearchStrings(nested, out);
    }
  } else {
    out.push(String(value));
  }
}

/**
 * Apply search + type + person filters to the list. Each is independent and
 * ANDed together; an empty filter matches everything. The input order (already
 * sorted newest-first upstream) is preserved.
 */
export function filterDocuments(
  documents: Document[],
  filters: DocumentFilters,
): Document[] {
  const search = filters.search.trim().toLowerCase();
  const personKey = filters.person.trim().toLowerCase();

  return documents.filter((doc) => {
    if (filters.docType && doc.metadata?.doc_type !== filters.docType) return false;

    if (personKey) {
      const people = getDocumentPeople(doc).map((p) => p.toLowerCase());
      if (!people.includes(personKey)) return false;
    }

    if (search && !searchableText(doc).includes(search)) return false;

    return true;
  });
}
