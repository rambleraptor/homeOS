/**
 * The collection resource + document membership field must survive the same
 * validation the boot-time schema sync runs, so a bad shape fails here rather
 * than at server boot.
 */

import { describe, expect, test } from 'vitest';
import {
  validateResourceDefinition,
  validateReferenceTargets,
  toWireSchema,
} from '@rambleraptor/homestead-core/resources/translate';
import { documentsResources, COLLECTIONS } from '../resources';

const byId = (singular: string) =>
  documentsResources.find((d) => d.singular === singular)!;

describe('collections resource', () => {
  test('every documents resource passes per-definition validation', () => {
    for (const def of documentsResources) {
      expect(() => validateResourceDefinition(def)).not.toThrow();
    }
  });

  test('cross-resource references resolve (collection + user)', () => {
    // `user` is a built-in root target; `collection` is declared alongside.
    expect(() => validateReferenceTargets(documentsResources)).not.toThrow();
  });

  test('collection is a private (acl) resource', () => {
    const collection = byId('collection');
    expect(collection.plural).toBe(COLLECTIONS);
    expect(collection.access?.model).toBe('acl');
  });

  test('document is acl and its collections field references collection', () => {
    const document = byId('document');
    expect(document.access?.model).toBe('acl');
    const collections = document.fields.collections;
    expect(collections?.type).toBe('array');
    expect(collections?.items?.reference?.resource).toBe('collection');
    // Deleting a collection drops the id from each document's membership.
    expect(collections?.items?.reference?.onDelete).toBe('set-null');
  });

  test('the collections field translates to an array wire property', () => {
    const wire = toWireSchema(byId('document').fields, 'document');
    const prop = wire.properties.collections;
    expect(prop?.type).toBe('array');
    expect(prop?.items?.type).toBe('string');
    // The reference marker rides on the array's items, machine-readable for the
    // engine's onDelete enforcement.
    expect(prop?.items?.['x-aepbase-reference']).toMatchObject({
      resource: 'collection',
      onDelete: 'set-null',
    });
  });
});
