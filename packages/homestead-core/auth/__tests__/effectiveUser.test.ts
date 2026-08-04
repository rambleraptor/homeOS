import { describe, it, expect } from 'vitest';
import { computeEffectiveUser, type ViewAsIdentity } from '../effectiveUser';
import type { User } from '../types';
import type { PermissionContext } from '../../permissions/client';

const superuser: User = {
  id: 'admin',
  email: 'admin@example.com',
  username: 'admin@example.com',
  name: 'The Admin',
  avatar: 'admin.png',
  verified: true,
  created: '2024-01-01',
  updated: '2024-01-01',
  type: 'superuser',
  permissions: { enforced: true, groupIds: ['g-admin'], groupNames: ['Admins'], grants: [] },
};

const targetCtx: PermissionContext = {
  enforced: true,
  groupIds: ['g-kids'],
  groupNames: ['Kids'],
  grants: [],
};

const target: ViewAsIdentity = {
  id: 'kid',
  name: 'A Kid',
  email: 'kid@example.com',
  type: 'regular',
  permissions: targetCtx,
};

describe('computeEffectiveUser', () => {
  it('returns the real user unchanged when no preview is active', () => {
    expect(computeEffectiveUser(superuser, null)).toBe(superuser);
  });

  it('returns null when there is no logged-in user', () => {
    expect(computeEffectiveUser(null, target)).toBeNull();
  });

  it('overrides the permission-relevant fields with the target during a preview', () => {
    const eff = computeEffectiveUser(superuser, target)!;
    expect(eff.id).toBe('kid');
    expect(eff.type).toBe('regular');
    expect(eff.permissions).toBe(targetCtx);
    expect(eff.name).toBe('A Kid');
    expect(eff.email).toBe('kid@example.com');
  });

  it('does not leak the superuser display identity into the preview', () => {
    const eff = computeEffectiveUser(superuser, target)!;
    // Break-glass identity must not bleed through: the effective user is no
    // longer a superuser, so `useCan`/`useAppVisible` stop short-circuiting.
    expect(eff.type).not.toBe('superuser');
    expect(eff.avatar).toBeUndefined();
  });

  it('previewing another superuser keeps full (superuser) access', () => {
    const otherAdmin: ViewAsIdentity = { ...target, id: 'admin2', type: 'superuser' };
    expect(computeEffectiveUser(superuser, otherAdmin)!.type).toBe('superuser');
  });

  it('does not mutate the real user object', () => {
    const snapshot = { ...superuser };
    computeEffectiveUser(superuser, target);
    expect(superuser).toEqual(snapshot);
  });
});
