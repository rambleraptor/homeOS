/**
 * The client `can()` mirror (canWith) runs the shared resolver over the context
 * the server hands down. It must stay permissive when enforcement is off (the
 * server allows everything then) and otherwise agree with the engine.
 */

import { describe, expect, it } from 'vitest';
import { canWith, type PermissionContext } from '../client';
import type { Grant } from '../resolve';

function ctx(over: Partial<PermissionContext> = {}): PermissionContext {
  return { enforced: true, groupIds: [], grants: [], ...over };
}

const OPEN: Grant = {
  subject: { type: 'everyone' },
  capability: 'write',
  effect: 'allow',
  target: { scope: 'all' },
};

describe('canWith', () => {
  it('is permissive when enforcement is off or the context is missing', () => {
    expect(canWith(ctx({ enforced: false }), 'alice', false, 'manage', 'book')).toBe(true);
    expect(canWith(undefined, 'alice', false, 'manage', 'book')).toBe(true);
  });

  it('always allows a superuser', () => {
    expect(canWith(ctx(), 'alice', true, 'manage', 'book')).toBe(true);
  });

  it('honors the open grant per the capability ladder', () => {
    expect(canWith(ctx({ grants: [OPEN] }), 'alice', false, 'write', 'book')).toBe(true);
    expect(canWith(ctx({ grants: [OPEN] }), 'alice', false, 'manage', 'book')).toBe(false);
  });

  it('default-denies with no matching grant', () => {
    expect(canWith(ctx(), 'alice', false, 'read', 'book')).toBe(false);
  });

  it('matches a group grant only for members', () => {
    const g: Grant = {
      subject: { type: 'group', id: 'parents' },
      capability: 'read',
      effect: 'allow',
      target: { scope: 'collection', resource_type: 'book' },
    };
    expect(canWith(ctx({ groupIds: ['parents'], grants: [g] }), 'alice', false, 'read', 'book')).toBe(true);
    expect(canWith(ctx({ groupIds: [], grants: [g] }), 'alice', false, 'read', 'book')).toBe(false);
  });

  it('deny always wins', () => {
    const deny: Grant = {
      subject: { type: 'everyone' },
      capability: 'read',
      effect: 'deny',
      target: { scope: 'all' },
    };
    expect(canWith(ctx({ grants: [OPEN, deny] }), 'alice', false, 'read', 'book')).toBe(false);
  });

  it('honors owner⇒manage when the owner is supplied', () => {
    expect(canWith(ctx(), 'alice', false, 'write', 'book', { recordId: 'b1', owner: 'alice' })).toBe(true);
    expect(canWith(ctx(), 'alice', false, 'write', 'book', { recordId: 'b1', owner: 'bob' })).toBe(false);
  });
});
