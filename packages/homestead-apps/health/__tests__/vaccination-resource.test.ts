/**
 * The vaccination resource must survive the same validation the boot-time
 * schema sync runs, so a bad shape fails here rather than at server boot —
 * and its privacy declaration is load-bearing, so it's pinned explicitly.
 */

import { describe, expect, test } from 'vitest';
import {
  validateResourceDefinition,
  validateReferenceTargets,
  toWireSchema,
} from '@rambleraptor/homestead-core/resources/translate';
import { healthResources, VACCINATIONS } from '../resources';
import { documentsResources } from '../../documents/resources';
import { peopleResources } from '../../people/resources';

const vaccination = healthResources.find((d) => d.singular === 'vaccination')!;

describe('vaccination resource', () => {
  test('every health resource passes per-definition validation', () => {
    for (const def of healthResources) {
      expect(() => validateResourceDefinition(def)).not.toThrow();
    }
  });

  test('cross-resource references resolve (user + document)', () => {
    // `user` is a built-in root target; `document` lives in the documents app
    // (whose own fields pull in `person`), so the boot-time check resolves the
    // link across the merged resource set.
    expect(() =>
      validateReferenceTargets([
        ...healthResources,
        ...documentsResources,
        ...peopleResources,
      ]),
    ).not.toThrow();
  });

  test('the document link references document with set-null', () => {
    const doc = vaccination.fields.document;
    expect(doc?.type).toBe('string');
    expect(doc?.reference?.resource).toBe('document');
    // One uploaded record can back several doses; deleting the document only
    // clears the links, never the vaccination rows themselves.
    expect(doc?.reference?.onDelete).toBe('set-null');
  });

  test('vaccination declares the private access model', () => {
    expect(vaccination.plural).toBe(VACCINATIONS);
    // The declaration is what scopes each household member to their own
    // records: the seeded role grant carries `created_by == subject.id`, and
    // owner visibility rides on the engine-set `_owner`. Removing this line
    // would expose everyone's health records household-wide.
    expect(vaccination.access).toEqual({ model: 'private' });
  });

  test('required fields are the vaccine name and administration date', () => {
    expect(vaccination.fields.vaccine?.required).toBe(true);
    expect(vaccination.fields.date_administered?.required).toBe(true);
    expect(vaccination.fields.next_due?.required).toBeUndefined();
  });

  test('the record image translates to a file-field wire property', () => {
    const wire = toWireSchema(vaccination.fields, 'vaccination');
    const prop = wire.properties.record_image;
    expect(prop?.type).toBe('binary');
    expect(prop?.['x-aepbase-file-field']).toBe(true);
  });
});
