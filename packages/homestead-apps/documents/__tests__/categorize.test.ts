import { describe, expect, it } from 'vitest';
import { groupDocumentsByCategory } from '../categorize';
import type { Document } from '../types';

function doc(id: string, docType?: string): Document {
  return {
    id,
    path: `documents/${id}`,
    metadata: docType ? { doc_type: docType } : undefined,
  };
}

describe('groupDocumentsByCategory', () => {
  it('buckets documents by their doc type category', () => {
    const groups = groupDocumentsByCategory([
      doc('a', 'form-w2'), // tax
      doc('b', 'medical-receipt'), // medical
    ]);
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g.documents.map((d) => d.id)]));
    expect(byKey.tax).toEqual(['a']);
    expect(byKey.medical).toEqual(['b']);
  });

  it('sorts named categories alphabetically with Other last', () => {
    const groups = groupDocumentsByCategory([
      doc('u', undefined), // no type → other
      doc('t', 'form-w2'), // tax
      doc('m', 'medical-receipt'), // medical
    ]);
    expect(groups.map((g) => g.label)).toEqual(['Medical', 'Tax', 'Other']);
  });

  it('puts uncategorized, unrecognized, and unparsed documents in Other', () => {
    const groups = groupDocumentsByCategory([
      doc('a', undefined), // unparsed
      doc('b', 'unknown'), // matched no type
      doc('c', 'recipe'), // a real type that declares no category
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.key).toBe('other');
    expect(groups[0]!.documents.map((d) => d.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns no groups for an empty list', () => {
    expect(groupDocumentsByCategory([])).toEqual([]);
  });
});
