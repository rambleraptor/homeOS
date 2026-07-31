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
import { matchPersonByName } from '../people/utils/matchPerson';
import type { Person } from '../people/types';
import type { Document } from './types';

/** The discriminator value the type facet uses for "matched no known type". */
export const UNRECOGNISED_TYPE = UNKNOWN_DOC_TYPE;

export interface DocumentFilters {
  /** Free-text search over title, tags, type label, and parsed metadata values. */
  search: string;
  /** A doc type id, `UNRECOGNISED_TYPE`, or '' for "any type". */
  docType: string;
  /**
   * A person *identity key* (see `personIdentity`), or '' for "anyone". Not a
   * raw name: two spellings of the same directory person share one key, so the
   * filter follows aliases rather than exact text.
   */
  person: string;
  /** A tag to filter by (exact match), or '' for "any tag". */
  tag: string;
}

export const EMPTY_FILTERS: DocumentFilters = {
  search: '',
  docType: '',
  person: '',
  tag: '',
};

/** Whether any filter is active — drives the "no matches" vs "empty" copy. */
export function hasActiveFilters(filters: DocumentFilters): boolean {
  return !!(filters.search.trim() || filters.docType || filters.person || filters.tag);
}

/**
 * Every distinct tag used across the documents, sorted for a stable dropdown.
 * Like the type facet, only surfacing tags in use keeps the filter to what's
 * actually selectable.
 */
export function collectTagFacets(documents: Document[]): string[] {
  const tags = new Set<string>();
  for (const doc of documents) {
    for (const tag of doc.tags ?? []) tags.add(tag);
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
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

/** A person facet entry: a stable identity key and its display label. */
export interface PersonFacet {
  value: string;
  label: string;
}

/** Trim, lowercase, and collapse internal whitespace — mirrors `matchPersonByName`. */
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Resolve an extracted name to a stable person identity against the directory.
 *
 * When the name matches exactly one directory person (by name or any alias,
 * case- and whitespace-insensitively), that person *is* the identity — so
 * "Robert Smith" and his alias "Bob Smith" collapse to one entry keyed by id
 * and labelled with his canonical name. A name the directory doesn't know (no
 * match, or an ambiguous one) falls back to a self-identity keyed by the
 * normalized name, so unknown people still dedupe by spelling without ever
 * being merged with a directory person.
 */
export function personIdentity(name: string, people: Person[]): PersonFacet {
  const match = matchPersonByName(name, people);
  if (match) return { value: `person:${match.id}`, label: match.name };
  return { value: `name:${normalizeName(name)}`, label: name.trim() };
}

/**
 * Every distinct person named across the documents, resolved through the
 * directory so aliases of one person become a single entry, then sorted for a
 * stable dropdown. Derived from metadata via `getDocumentPeople`, never stored.
 */
export function collectPeople(documents: Document[], people: Person[]): PersonFacet[] {
  const byKey = new Map<string, PersonFacet>();
  for (const doc of documents) {
    for (const name of getDocumentPeople(doc)) {
      const identity = personIdentity(name, people);
      // A directory match's label is the canonical name (stable across
      // spellings); for an unknown name, keep the first spelling seen.
      if (!byKey.has(identity.value)) byKey.set(identity.value, identity);
    }
  }
  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** The searchable text of a document: its title, tags, type label, and metadata values. */
function searchableText(doc: Document): string {
  const parts: string[] = [];
  if (doc.title) parts.push(doc.title);
  if (doc.tags) parts.push(...doc.tags);

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
 * Apply search + type + person + tag filters to the list. Each is independent and
 * ANDed together; an empty filter matches everything. The input order (already
 * sorted newest-first upstream) is preserved.
 *
 * `people` is the directory used to resolve names to identities, so the person
 * filter follows aliases: a document matches the selected person when *any* name
 * it extracted resolves to that same identity key.
 */
export function filterDocuments(
  documents: Document[],
  filters: DocumentFilters,
  people: Person[],
): Document[] {
  const search = filters.search.trim().toLowerCase();
  const personKey = filters.person.trim();
  const tag = filters.tag.trim();

  return documents.filter((doc) => {
    if (filters.docType && doc.metadata?.doc_type !== filters.docType) return false;

    if (tag && !(doc.tags ?? []).includes(tag)) return false;

    if (personKey) {
      const identities = getDocumentPeople(doc).map(
        (name) => personIdentity(name, people).value,
      );
      if (!identities.includes(personKey)) return false;
    }

    if (search && !searchableText(doc).includes(search)) return false;

    return true;
  });
}
