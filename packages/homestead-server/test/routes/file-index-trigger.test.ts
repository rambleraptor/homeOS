/**
 * Unit tests for the file-index trigger's path classification and id extraction
 * — the parts most likely to silently mis-route a request (and wrongly consume
 * a body). The full upload→index flow is exercised end-to-end by the e2e suite.
 */

import { describe, expect, test } from 'vitest';
import { idFromCreateBody, parseCrudWrite } from '../../src/routes/file-index-paths';

describe('parseCrudWrite', () => {
  test('classifies a collection create', () => {
    expect(parseCrudWrite('/documents')).toEqual({ plural: 'documents' });
  });

  test('classifies an item write/delete', () => {
    expect(parseCrudWrite('/documents/abc123')).toEqual({
      plural: 'documents',
      id: 'abc123',
    });
  });

  test('ignores the query string', () => {
    expect(parseCrudWrite('/documents/abc123?force=true')).toEqual({
      plural: 'documents',
      id: 'abc123',
    });
  });

  test('defers custom-method paths (colon verb)', () => {
    expect(parseCrudWrite('/documents/abc:classify')).toBeNull();
    expect(parseCrudWrite('/documents:bulk-import')).toBeNull();
    expect(parseCrudWrite('/documents/abc:download')).toBeNull();
  });

  test('defers nested (parented) resource paths', () => {
    expect(parseCrudWrite('/gift-cards/g1/transactions/t1')).toBeNull();
  });

  test('returns null for an empty path', () => {
    expect(parseCrudWrite('/')).toBeNull();
    expect(parseCrudWrite('')).toBeNull();
  });

  test('tolerates trailing slashes', () => {
    expect(parseCrudWrite('/documents/')).toEqual({ plural: 'documents' });
  });
});

describe('idFromCreateBody', () => {
  test('reads a top-level id', () => {
    expect(idFromCreateBody({ id: 'doc_1' })).toBe('doc_1');
  });

  test('falls back to the last segment of path/name', () => {
    expect(idFromCreateBody({ path: 'documents/doc_2' })).toBe('doc_2');
    expect(idFromCreateBody({ name: 'documents/doc_3' })).toBe('doc_3');
  });

  test('returns undefined for a bodyless / non-object response', () => {
    expect(idFromCreateBody(null)).toBeUndefined();
    expect(idFromCreateBody('nope')).toBeUndefined();
    expect(idFromCreateBody({})).toBeUndefined();
  });
});
