/**
 * The category colour system. The assertions that matter here are the ones a
 * type-checker can't make: that every category a doc type actually declares has
 * a tone (a new category otherwise silently renders neutral), and that a
 * document only wears its colour once it's genuinely parsed.
 */

import { describe, it, expect } from 'vitest';
import {
  categoryLabel,
  categoryTone,
  documentCategory,
  OTHER_CATEGORY,
} from '../categories';
import { getDocTypes } from '../doc-types/registry';
import type { Document } from '../types';

function doc(overrides: Partial<Document> = {}): Document {
  return {
    id: 'doc1',
    path: 'documents/doc1',
    parse_status: 'parsed',
    metadata: { doc_type: 'form-w2' },
    ...overrides,
  };
}

describe('categoryTone', () => {
  it('gives every category declared by a doc type its own tone', () => {
    const declared = new Set(
      getDocTypes()
        .map((type) => type.category)
        .filter((category): category is string => !!category),
    );
    expect(declared.size).toBeGreaterThan(0);

    const neutral = categoryTone(undefined);
    for (const category of declared) {
      expect(
        categoryTone(category),
        `category "${category}" has no tone and falls back to neutral`,
      ).not.toEqual(neutral);
    }
  });

  it('gives distinct categories distinct surfaces', () => {
    const surfaces = ['tax', 'medical', 'insurance', 'home'].map(
      (category) => categoryTone(category).surface,
    );
    expect(new Set(surfaces).size).toBe(surfaces.length);
  });

  it('falls back to the neutral tone for an unknown or absent category', () => {
    expect(categoryTone('not-a-category')).toEqual(categoryTone(undefined));
    expect(categoryTone(OTHER_CATEGORY)).toEqual(categoryTone(undefined));
  });
});

describe('categoryLabel', () => {
  it('title-cases a kebab-case category', () => {
    expect(categoryLabel('tax')).toBe('Tax');
    expect(categoryLabel('property-tax')).toBe('Property Tax');
  });

  it('names the catch-all bucket "Other"', () => {
    expect(categoryLabel(OTHER_CATEGORY)).toBe('Other');
  });
});

describe('documentCategory', () => {
  it("uses the matched doc type's category", () => {
    expect(documentCategory(doc())).toBe('tax');
  });

  it('is the catch-all while the document is still reading', () => {
    // The metadata may still hold a previous pass's guess — colouring on it
    // would flicker the row mid-classify.
    expect(documentCategory(doc({ parse_status: 'pending' }))).toBe(OTHER_CATEGORY);
  });

  it('is the catch-all for a document that matched no type', () => {
    expect(
      documentCategory(doc({ parse_status: 'unmatched', metadata: { doc_type: 'unknown' } })),
    ).toBe(OTHER_CATEGORY);
  });

  it('is the catch-all for a type that declares no category', () => {
    expect(documentCategory(doc({ metadata: { doc_type: 'recipe' } }))).toBe(
      OTHER_CATEGORY,
    );
  });

  it('is the catch-all for a doc type that no longer exists', () => {
    expect(documentCategory(doc({ metadata: { doc_type: 'form-retired' } }))).toBe(
      OTHER_CATEGORY,
    );
  });
});
