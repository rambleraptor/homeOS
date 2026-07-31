/**
 * The permission resource definitions must be valid authoring defs that
 * translate to wire schema and whose references resolve — otherwise the
 * boot-time schema sync fails fast.
 */

import { describe, expect, it } from 'vitest';
import { PERMISSION_RESOURCE_DEFS } from '../resources';
import { OPEN_GRANT, SEED_ROLES } from '../seed';
import { BUILTIN_RESOURCE_DEFS } from '../../resources/builtins';
import {
  toWireSchema,
  validateReferenceTargets,
  validateResourceDefinition,
} from '../../resources/translate';

describe('permission resource definitions', () => {
  it('each def passes authoring validation and translates to wire schema', () => {
    for (const def of PERMISSION_RESOURCE_DEFS) {
      expect(() => validateResourceDefinition(def)).not.toThrow();
      expect(() => toWireSchema(def.fields, def.singular)).not.toThrow();
    }
  });

  it('references resolve across the full definition set', () => {
    expect(() =>
      validateReferenceTargets([...BUILTIN_RESOURCE_DEFS, ...PERMISSION_RESOURCE_DEFS]),
    ).not.toThrow();
  });

  it('declares exactly the four expected resources', () => {
    expect(PERMISSION_RESOURCE_DEFS.map((d) => d.singular).sort()).toEqual([
      'access-grant',
      'group',
      'group-membership',
      'role',
    ]);
  });

  it('all four are superuser_write for now', () => {
    for (const def of PERMISSION_RESOURCE_DEFS) {
      expect(def.superuser_write).toBe(true);
    }
  });

  it('group-membership is parented under group', () => {
    const membership = PERMISSION_RESOURCE_DEFS.find((d) => d.singular === 'group-membership');
    expect(membership?.parents).toEqual(['group']);
  });
});

describe('permission seed data', () => {
  it('seeds admin/member/guest with the expected capability bundles', () => {
    const byId = Object.fromEntries(SEED_ROLES.map((r) => [r.id, r]));
    expect(byId.admin.grants).toEqual([{ target_scope: 'all', capability: 'manage' }]);
    expect(byId.member.grants).toEqual([{ target_scope: 'all', capability: 'write' }]);
    expect(byId.guest.grants).toEqual([]); // empty until granted (§11 #4)
  });

  it('the open-household grant is everyone → write on *', () => {
    expect(OPEN_GRANT).toEqual({
      subject_type: 'everyone',
      target_scope: 'all',
      capability: 'write',
      effect: 'allow',
    });
  });
});
