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
  filterDocuments,
  hasActiveFilters,
  UNRECOGNISED_TYPE,
} from '../filtering';
import { getDocumentPeople } from '../doc-types/people';
import type { Document } from '../types';

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

describe('collectPeople', () => {
  it('unions people across documents, sorted and case-insensitively deduped', () => {
    const dupe = doc({ doc_type: 'medical-receipt', patient: 'jane doe' });
    expect(collectPeople([...all, dupe])).toEqual(['Jane Doe', 'John Roe', 'Sam Doe']);
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

describe('filterDocuments', () => {
  it('returns everything with empty filters', () => {
    expect(filterDocuments(all, { search: '', docType: '', person: '' })).toEqual(all);
  });

  it('filters by document type', () => {
    expect(
      filterDocuments(all, { search: '', docType: 'form-w2', person: '' }),
    ).toEqual([w2]);
  });

  it('filters by the Unrecognised type', () => {
    expect(
      filterDocuments(all, { search: '', docType: UNRECOGNISED_TYPE, person: '' }),
    ).toEqual([unknown]);
  });

  it('filters by person across scalar and array fields', () => {
    // Jane Doe is the W-2 employee and both the insured + a driver on the policy.
    expect(
      filterDocuments(all, { search: '', docType: '', person: 'Jane Doe' }),
    ).toEqual([w2, policy]);
    expect(
      filterDocuments(all, { search: '', docType: '', person: 'Sam Doe' }),
    ).toEqual([policy]);
  });

  it('matches person case-insensitively', () => {
    expect(
      filterDocuments(all, { search: '', docType: '', person: 'jane doe' }),
    ).toEqual([w2, policy]);
  });

  it('searches titles', () => {
    expect(filterDocuments(all, { search: 'mystery', docType: '', person: '' })).toEqual([
      unknown,
    ]);
  });

  it('searches parsed metadata values', () => {
    expect(filterDocuments(all, { search: 'geico', docType: '', person: '' })).toEqual([
      policy,
    ]);
    expect(
      filterDocuments(all, { search: 'city pharmacy', docType: '', person: '' }),
    ).toEqual([receipt]);
  });

  it('searches the type label', () => {
    expect(
      filterDocuments(all, { search: 'insurance', docType: '', person: '' }),
    ).toEqual([policy]);
  });

  it('ANDs the filters together', () => {
    expect(
      filterDocuments(all, { search: 'policy', docType: 'form-w2', person: '' }),
    ).toEqual([]);
    expect(
      filterDocuments(all, {
        search: 'auto',
        docType: 'auto-insurance-policy',
        person: 'Sam Doe',
      }),
    ).toEqual([policy]);
  });
});

describe('hasActiveFilters', () => {
  it('is false only when every filter is blank', () => {
    expect(hasActiveFilters({ search: '', docType: '', person: '' })).toBe(false);
    expect(hasActiveFilters({ search: '  ', docType: '', person: '' })).toBe(false);
    expect(hasActiveFilters({ search: 'x', docType: '', person: '' })).toBe(true);
    expect(hasActiveFilters({ search: '', docType: 'form-w2', person: '' })).toBe(true);
    expect(hasActiveFilters({ search: '', docType: '', person: 'Jane Doe' })).toBe(true);
  });
});
