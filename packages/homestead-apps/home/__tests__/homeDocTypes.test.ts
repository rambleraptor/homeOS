import { describe, expect, it } from 'vitest';
import { getDocType } from '../../documents/doc-types/registry';
import type { Document } from '../../documents/types';
import { HOME_DOC_TYPE_IDS, isHomeDocument } from '../homeDocTypes';

/** Minimal document stub with a matched type. */
const doc = (docType?: string): Document =>
  ({ id: 'd1', metadata: docType ? { doc_type: docType } : undefined }) as Document;

describe('HOME_DOC_TYPE_IDS', () => {
  it('every id is a real declared doc type', () => {
    // Guards against a typo or a renamed/removed type silently emptying the
    // Home app — the id must still resolve to a doc type in the catalog.
    for (const id of HOME_DOC_TYPE_IDS) {
      expect(getDocType(id), id).toBeDefined();
    }
  });

  it('has no duplicates', () => {
    expect(new Set(HOME_DOC_TYPE_IDS).size).toBe(HOME_DOC_TYPE_IDS.length);
  });
});

describe('isHomeDocument', () => {
  it('accepts each home type', () => {
    for (const id of HOME_DOC_TYPE_IDS) {
      expect(isHomeDocument(doc(id)), id).toBe(true);
    }
  });

  it('rejects a non-home type', () => {
    expect(isHomeDocument(doc('form-w2'))).toBe(false);
    expect(isHomeDocument(doc('medical-receipt'))).toBe(false);
  });

  it('rejects a document that matched no type', () => {
    expect(isHomeDocument(doc('unknown'))).toBe(false);
    expect(isHomeDocument(doc(undefined))).toBe(false);
  });
});
