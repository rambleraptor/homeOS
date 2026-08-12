/**
 * Guards that the home resource definitions stay valid for the boot-time schema
 * sync: each definition passes name/field validation, translates to a wire
 * schema, and its references resolve against the wider resource set.
 */

import { describe, it, expect } from 'vitest';
import {
  toWireSchema,
  validateReferenceTargets,
  validateResourceDefinition,
} from '@rambleraptor/homestead-core/resources/translate';
import { BUILTIN_RESOURCE_DEFS } from '@rambleraptor/homestead-core/resources/builtins';
import { GARBAGE_STREAMS, homeResources } from '../resources';

describe('home resource definitions', () => {
  it('each definition passes validation', () => {
    for (const def of homeResources) {
      expect(() => validateResourceDefinition(def)).not.toThrow();
    }
  });

  it('each definition translates to a wire schema', () => {
    for (const def of homeResources) {
      expect(() => toWireSchema(def.fields, def.singular)).not.toThrow();
    }
  });

  it('references resolve against the full resource set', () => {
    expect(() =>
      validateReferenceTargets([...homeResources, ...BUILTIN_RESOURCE_DEFS]),
    ).not.toThrow();
  });

  it('garbage-pickup requires a date and a stream', () => {
    const def = homeResources[0]!;
    const wire = toWireSchema(def.fields, def.singular);
    expect(wire.required).toEqual(
      expect.arrayContaining(['pickup_date', 'stream']),
    );
  });

  it('encodes the stream enum into the wire description, since aepbase strips enum', () => {
    const def = homeResources[0]!;
    const wire = toWireSchema(def.fields, def.singular);
    expect(wire.properties.stream?.description).toContain('one of:');
    for (const stream of GARBAGE_STREAMS) {
      expect(wire.properties.stream?.description).toContain(stream);
    }
  });

  it('stream enum values are kebab-case, matching the aepbase naming rule', () => {
    for (const stream of GARBAGE_STREAMS) {
      expect(stream).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });
});
