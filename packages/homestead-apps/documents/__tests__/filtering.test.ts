/**
 * Filtering + people derivation for the documents index.
 *
 * Exercised against the real built-in doc types (not fixtures), so the person
 * markers and type labels these depend on stay honest — a mismarked field or a
 * renamed type fails here.
 */

import { describe, expect, it } from 'vitest';
import {
  collectDocTypeFacets,
  collectPeople,
  collectTagFacets,
  EMPTY_FILTERS,
  filterDocuments,
  hasActiveFilters,
  personIdentity,
  UNRECOGNISED_TYPE,
  type DocumentFilters,
} from '../filtering';
import { getDocumentPeople } from '../doc-types/people';
import type { Document } from '../types';
import type { Person } from '../../people/types';

/** A parsed document with the given type + metadata; ids are auto-assigned. */
let idSeq = 0;
function doc(
  metadata: Record<string, unknown> | undefined,
  extra: Partial<Document> = {},
): Document {
  idSeq += 1;
  return {
    id: `doc-${idSeq}`,
    path: `documents/doc-${idSeq}`,
    parse_status: 'parsed',
    ...extra,
    metadata: metadata as Document['metadata'],
  };
}

function person(id: string, name: string, aliases: string[] = []): Person {
  return { id, name, aliases, addresses: [], created_by: 'u', created: '', updated: '' };
}

const w2 = doc(
  { doc_type: 'form-w2', employee_name: 'Jane Doe', employer_name: 'Acme Corp' },
  { title: "Jane's 2024 W-2" },
);
const receipt = doc(
  { doc_type: 'medical-receipt', patient: 'John Roe', merchant: 'City Pharmacy' },
  { title: 'Pharmacy receipt' },
);
const policy = doc(
  {
    doc_type: 'auto-insurance-policy',
    carrier: 'GEICO',
    named_insured: 'Jane Doe',
    covered_drivers: ['Jane Doe', 'Sam Doe'],
  },
  { title: 'Auto policy 2024' },
);
const unknown = doc({ doc_type: UNRECOGNISED_TYPE }, { title: 'Mystery scan' });
const pending = doc(undefined, { title: 'Still reading', parse_status: 'pending' });

const all = [w2, receipt, policy, unknown, pending];

/** No people directory — every name resolves to a by-spelling identity. */
const NO_DIRECTORY: Person[] = [];

/** Build a full filter set, overriding only the fields a test cares about. */
function filters(partial: Partial<DocumentFilters> = {}): DocumentFilters {
  return { ...EMPTY_FILTERS, ...partial };
}

describe('getDocumentPeople', () => {
  it('pulls the person-flagged scalar field', () => {
    expect(getDocumentPeople(w2)).toEqual(['Jane Doe']);
  });

  it('pulls a person-flagged medical patient', () => {
    expect(getDocumentPeople(receipt)).toEqual(['John Roe']);
  });

  it('pulls the named insured plus each covered driver, deduped', () => {
    // named_insured "Jane Doe" repeats in covered_drivers — collapsed once.
    expect(getDocumentPeople(policy)).toEqual(['Jane Doe', 'Sam Doe']);
  });

  it('ignores business/company fields', () => {
    expect(getDocumentPeople(w2)).not.toContain('Acme Corp');
    expect(getDocumentPeople(receipt)).not.toContain('City Pharmacy');
  });

  it('returns nothing for unmatched or unparsed documents', () => {
    expect(getDocumentPeople(unknown)).toEqual([]);
    expect(getDocumentPeople(pending)).toEqual([]);
  });
});

describe('personIdentity', () => {
  const directory = [person('p1', 'Robert Smith', ['Bob Smith', 'Bobby'])];

  it('resolves a directory match (by name or alias) to one id-keyed identity', () => {
    // Every spelling of Robert collapses to the same key, labelled canonically.
    expect(personIdentity('Robert Smith', directory)).toEqual({
      value: 'person:p1',
      label: 'Robert Smith',
    });
    expect(personIdentity('bob  smith', directory)).toEqual({
      value: 'person:p1',
      label: 'Robert Smith',
    });
    expect(personIdentity('Bobby', directory)).toEqual({
      value: 'person:p1',
      label: 'Robert Smith',
    });
  });

  it('keys an unknown name by its normalized spelling, keeping the original label', () => {
    // The key collapses whitespace + lowercases (so "Jane  Doe" and "Jane Doe"
    // dedupe); the label only trims, staying faithful to the extracted spelling.
    expect(personIdentity('  Jane   Doe ', directory)).toEqual({
      value: 'name:jane doe',
      label: 'Jane   Doe',
    });
  });

  it('does not merge an ambiguous name into a directory person', () => {
    const ambiguous = [person('a', 'Sam'), person('b', 'sam')];
    // matchPersonByName bails on ambiguity, so it stays a by-name identity.
    expect(personIdentity('Sam', ambiguous).value).toBe('name:sam');
  });
});

describe('collectPeople', () => {
  it('unions people, case-insensitively deduped and sorted, with no directory', () => {
    const dupe = doc({ doc_type: 'medical-receipt', patient: 'jane doe' });
    expect(collectPeople([...all, dupe], NO_DIRECTORY)).toEqual([
      { value: 'name:jane doe', label: 'Jane Doe' },
      { value: 'name:john roe', label: 'John Roe' },
      { value: 'name:sam doe', label: 'Sam Doe' },
    ]);
  });

  it('collapses aliases of one directory person into a single canonical entry', () => {
    // Jane appears as "Jane Doe" (W-2, policy) and here as her alias "Janey".
    const aliasDoc = doc({ doc_type: 'medical-receipt', patient: 'Janey' });
    const directory = [person('p1', 'Jane Doe', ['Janey'])];
    const facets = collectPeople([w2, policy, aliasDoc], directory);
    expect(facets).toEqual([
      { value: 'person:p1', label: 'Jane Doe' },
      { value: 'name:sam doe', label: 'Sam Doe' },
    ]);
  });
});

describe('collectDocTypeFacets', () => {
  it('lists only the types present, labelled, with Unrecognised last', () => {
    expect(collectDocTypeFacets(all)).toEqual([
      { value: 'auto-insurance-policy', label: 'Auto insurance policy' },
      { value: 'form-w2', label: 'Form W-2' },
      { value: 'medical-receipt', label: 'Medical receipt' },
      { value: UNRECOGNISED_TYPE, label: 'Unrecognised' },
    ]);
  });

  it('omits Unrecognised when every document matched a type', () => {
    expect(collectDocTypeFacets([w2, receipt]).map((f) => f.value)).toEqual([
      'form-w2',
      'medical-receipt',
    ]);
  });
});

describe('collectTagFacets', () => {
  it('lists every distinct tag in use, sorted, deduped across documents', () => {
    const a = doc({ doc_type: 'form-w2' }, { tags: ['taxes', 'urgent'] });
    const b = doc({ doc_type: 'medical-receipt' }, { tags: ['urgent', 'reimburse'] });
    const c = doc({ doc_type: UNRECOGNISED_TYPE });
    expect(collectTagFacets([a, b, c])).toEqual(['reimburse', 'taxes', 'urgent']);
  });

  it('is empty when no document has tags', () => {
    expect(collectTagFacets(all)).toEqual([]);
  });
});

describe('filterDocuments', () => {
  const taxDoc = doc({ doc_type: 'form-w2', employee_name: 'Pat Lee' }, { tags: ['taxes'] });
  const withTags = [...all, taxDoc];

  it('returns everything with empty filters', () => {
    expect(filterDocuments(all, filters(), NO_DIRECTORY)).toEqual(all);
  });

  it('filters by document type', () => {
    expect(filterDocuments(all, filters({ docType: 'form-w2' }), NO_DIRECTORY)).toEqual([w2]);
  });

  it('filters by the Unrecognised type', () => {
    expect(
      filterDocuments(all, filters({ docType: UNRECOGNISED_TYPE }), NO_DIRECTORY),
    ).toEqual([unknown]);
  });

  it('filters by an exact tag', () => {
    expect(filterDocuments(withTags, filters({ tag: 'taxes' }), NO_DIRECTORY)).toEqual([
      taxDoc,
    ]);
    // A tag no document carries matches nothing.
    expect(filterDocuments(withTags, filters({ tag: 'missing' }), NO_DIRECTORY)).toEqual([]);
  });

  it('filters by a by-name identity across scalar and array fields', () => {
    // Jane Doe is the W-2 employee and both the insured + a driver on the policy.
    const jane = personIdentity('Jane Doe', NO_DIRECTORY).value;
    expect(filterDocuments(all, filters({ person: jane }), NO_DIRECTORY)).toEqual([w2, policy]);

    const sam = personIdentity('Sam Doe', NO_DIRECTORY).value;
    expect(filterDocuments(all, filters({ person: sam }), NO_DIRECTORY)).toEqual([policy]);
  });

  it('filters by a directory person across every alias, on any document', () => {
    // A doc naming Jane by her alias must match the same person filter as the
    // docs naming her canonically — the whole point of alias-aware filtering.
    const aliasDoc = doc({ doc_type: 'medical-receipt', patient: 'Janey' });
    const directory = [person('p1', 'Jane Doe', ['Janey'])];
    const result = filterDocuments(
      [w2, receipt, policy, aliasDoc],
      filters({ person: 'person:p1' }),
      directory,
    );
    expect(result).toEqual([w2, policy, aliasDoc]);
  });

  it('searches titles', () => {
    expect(filterDocuments(all, filters({ search: 'mystery' }), NO_DIRECTORY)).toEqual([unknown]);
  });

  it('searches tags', () => {
    expect(filterDocuments(withTags, filters({ search: 'taxes' }), NO_DIRECTORY)).toEqual([
      taxDoc,
    ]);
  });

  it('searches parsed metadata values', () => {
    expect(filterDocuments(all, filters({ search: 'geico' }), NO_DIRECTORY)).toEqual([policy]);
    expect(
      filterDocuments(all, filters({ search: 'city pharmacy' }), NO_DIRECTORY),
    ).toEqual([receipt]);
  });

  it('searches the type label', () => {
    expect(filterDocuments(all, filters({ search: 'insurance' }), NO_DIRECTORY)).toEqual([policy]);
  });

  it('ANDs the filters together', () => {
    expect(
      filterDocuments(all, filters({ search: 'policy', docType: 'form-w2' }), NO_DIRECTORY),
    ).toEqual([]);
    const sam = personIdentity('Sam Doe', NO_DIRECTORY).value;
    expect(
      filterDocuments(
        all,
        filters({ search: 'auto', docType: 'auto-insurance-policy', person: sam }),
        NO_DIRECTORY,
      ),
    ).toEqual([policy]);
  });
});

describe('hasActiveFilters', () => {
  it('is false only when every filter is blank', () => {
    expect(hasActiveFilters(filters())).toBe(false);
    expect(hasActiveFilters(filters({ search: '  ' }))).toBe(false);
    expect(hasActiveFilters(filters({ search: 'x' }))).toBe(true);
    expect(hasActiveFilters(filters({ docType: 'form-w2' }))).toBe(true);
    expect(hasActiveFilters(filters({ person: 'person:p1' }))).toBe(true);
    expect(hasActiveFilters(filters({ tag: 'taxes' }))).toBe(true);
  });
});
