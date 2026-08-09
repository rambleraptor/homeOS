/**
 * Guards that the events resource definitions stay valid for the boot-time
 * schema sync: each definition passes name/field validation and translates to
 * a wire schema, and their references resolve against the wider resource set
 * (event-reminder → event, event.people → person, created_by → user).
 */

import { describe, it, expect } from 'vitest';
import {
  toWireSchema,
  validateReferenceTargets,
  validateResourceDefinition,
} from '@rambleraptor/homestead-core/resources/translate';
import { BUILTIN_RESOURCE_DEFS } from '@rambleraptor/homestead-core/resources/builtins';
import { eventsResources } from '../resources';
import { peopleResources } from '../../people/resources';

describe('events resource definitions', () => {
  it('each definition passes validation', () => {
    for (const def of eventsResources) {
      expect(() => validateResourceDefinition(def)).not.toThrow();
    }
  });

  it('each definition translates to a wire schema', () => {
    for (const def of eventsResources) {
      expect(() => toWireSchema(def)).not.toThrow();
    }
  });

  it('references resolve against the full resource set', () => {
    expect(() =>
      validateReferenceTargets([
        ...eventsResources,
        ...peopleResources,
        ...BUILTIN_RESOURCE_DEFS,
      ]),
    ).not.toThrow();
  });
});
