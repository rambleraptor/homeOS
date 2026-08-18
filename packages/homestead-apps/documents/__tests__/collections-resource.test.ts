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
import { PRIVATE_COLLECTIONS } from '@rambleraptor/homestead-core/permissions/household';
import { peopleResources } from '../../people/resources';

const byId = (singular: string) =>
  documentsResources.find((d) => d.singular === singular)!;

describe('collections resource', () => {
  test('every documents resource passes per-definition validation', () => {
    for (const def of documentsResources) {
      expect(() => validateResourceDefinition(def)).not.toThrow();
    }
  });

  test('cross-resource references resolve (collection + user + person)', () => {
    // `user` is a built-in root target; `collection` is declared alongside; the
    // document `people` field references `person`, which lives in the people app,
    // so the boot-time check resolves it across the merged resource set.
    expect(() =>
      validateReferenceTargets([...documentsResources, ...peopleResources]),
    ).not.toThrow();
  });

  test('collection is one of the private-by-default collections', () => {
    const collection = byId('collection');
    expect(collection.plural).toBe(COLLECTIONS);
    // Privacy isn't declared on the resource any more — there is no access
    // model. A household role covers `collection` only for a member's own rows,
    // which is what leaves a folder invisible until it's shared.
    expect(PRIVATE_COLLECTIONS).toContain('collection');
  });

  test('document is private by default and its collections field references collection', () => {
    const document = byId('document');
    expect(PRIVATE_COLLECTIONS).toContain('document');
    const collections = document.fields.collections;
    expect(collections?.type).toBe('array');
    expect(collections?.items?.reference?.resource).toBe('collection');
    // Deleting a collection drops the id from each document's membership.
    expect(collections?.items?.reference?.onDelete).toBe('set-null');
  });

  test('document people field references person with set-null', () => {
    const people = byId('document').fields.people;
    expect(people?.type).toBe('array');
    expect(people?.items?.reference?.resource).toBe('person');
    // Deleting a person drops their id from each document's people list.
    expect(people?.items?.reference?.onDelete).toBe('set-null');
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
