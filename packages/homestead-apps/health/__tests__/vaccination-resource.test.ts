/**
 * The vaccine + vaccination resources must survive the same validation the
 * boot-time schema sync runs, so a bad shape fails here rather than at
 * server boot — and the privacy declarations are load-bearing, so they're
 * pinned explicitly.
 */

import { describe, expect, test } from 'vitest';
import {
  validateResourceDefinition,
  validateReferenceTargets,
  toWireSchema,
} from '@rambleraptor/homestead-core/resources/translate';
import { healthResources, VACCINES, VACCINATIONS } from '../resources';
import { documentsResources } from '../../documents/resources';
import { peopleResources } from '../../people/resources';

const vaccine = healthResources.find((d) => d.singular === 'vaccine')!;
const vaccination = healthResources.find((d) => d.singular === 'vaccination')!;

describe('health resources', () => {
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

  test('vaccination is a child of vaccine', () => {
    expect(vaccine.plural).toBe(VACCINES);
    expect(vaccination.plural).toBe(VACCINATIONS);
    // Doses live at /vaccines/{id}/vaccinations/{id}; the schema-sync runner
    // topo-sorts by parents so the vaccine definition applies first.
    expect(vaccination.parents).toEqual(['vaccine']);
  });

  test('both levels declare the private access model', () => {
    // The declaration is what scopes each household member to their own
    // records: the seeded role grant carries `created_by == subject.id`, and
    // owner visibility rides on the engine-set `_owner`. A grant matches one
    // resource_type, so the child needs its own declaration — removing either
    // line would expose that level's health records household-wide.
    expect(vaccine.access).toEqual({ model: 'private' });
    expect(vaccination.access).toEqual({ model: 'private' });
  });

  test('required fields: vaccine name; dose administration date', () => {
    expect(vaccine.fields.name?.required).toBe(true);
    expect(vaccine.fields.next_due?.required).toBeUndefined();
    expect(vaccination.fields.date_administered?.required).toBe(true);
  });

  test('series-level due date lives on the vaccine, not the dose', () => {
    expect(vaccine.fields.next_due?.format).toBe('date');
    expect(vaccination.fields.next_due).toBeUndefined();
  });

  test('the record image translates to a file-field wire property', () => {
    const wire = toWireSchema(vaccination.fields, 'vaccination');
    const prop = wire.properties.record_image;
    expect(prop?.type).toBe('binary');
    expect(prop?.['x-aepbase-file-field']).toBe(true);
  });

  test('the person link references person with set-null', () => {
    const person = vaccine.fields.person;
    expect(person?.type).toBe('string');
    expect(person?.reference?.resource).toBe('person');
    // A series belongs to a person (the patient), which for email-ingested
    // documents may not be the account that owns the record. Deleting the
    // person only clears the link, never the health history.
    expect(person?.reference?.onDelete).toBe('set-null');
  });

  test('the document link references document with set-null', () => {
    const doc = vaccination.fields.document;
    expect(doc?.type).toBe('string');
    expect(doc?.reference?.resource).toBe('document');
    // One uploaded record can back several doses; deleting the document only
    // clears the links, never the vaccination rows themselves.
    expect(doc?.reference?.onDelete).toBe('set-null');
  });
});
