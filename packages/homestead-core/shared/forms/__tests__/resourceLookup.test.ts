import { afterEach, describe, expect, it } from 'vitest';
import {
  initializeAppRegistry,
  resetAppRegistry,
} from '@rambleraptor/homestead-core/apps/registry';
import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';
import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';
import {
  resourceDefBySingular,
  pluralForSingular,
  isTopLevelReference,
} from '../resourceLookup';

const project: ResourceDefinition = {
  singular: 'project',
  plural: 'projects',
  fields: { name: { type: 'string', required: true } },
};

const transaction: ResourceDefinition = {
  singular: 'transaction',
  plural: 'transactions',
  parents: ['gift-card'],
  fields: { amount: { type: 'number' } },
};

function appWith(resources: ResourceDefinition[]): AppConfig {
  return { id: 'test', name: 'Test', description: 'test app', resources };
}

afterEach(() => {
  resetAppRegistry();
});

describe('resourceLookup', () => {
  it('resolves a declared resource singular to its definition and plural', () => {
    initializeAppRegistry([appWith([project])]);
    expect(resourceDefBySingular('project')?.plural).toBe('projects');
    expect(pluralForSingular('project')).toBe('projects');
  });

  it('maps the built-in user root without a declaration', () => {
    initializeAppRegistry([appWith([project])]);
    expect(pluralForSingular('user')).toBe('users');
    expect(isTopLevelReference('user')).toBe(true);
  });

  it('returns undefined for an unknown singular', () => {
    initializeAppRegistry([appWith([project])]);
    expect(pluralForSingular('nope')).toBeUndefined();
    expect(isTopLevelReference('nope')).toBe(false);
  });

  it('treats a parent-scoped resource as not top-level', () => {
    initializeAppRegistry([appWith([project, transaction])]);
    expect(pluralForSingular('transaction')).toBe('transactions');
    expect(isTopLevelReference('transaction')).toBe(false);
    expect(isTopLevelReference('project')).toBe(true);
  });
});
