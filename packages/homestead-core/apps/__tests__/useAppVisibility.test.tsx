/**
 * useAppVisible passes the app id to `can()`, so an app-scope deny grant
 * actually hides that app from navigation (and only that app) — matching the
 * engine, which resolves app access with the owning app id.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { PermissionContext } from '../../permissions/client';
import type { AppConfig } from '../types';

// Mock the auth seam both useAppVisible and useCan read through.
const authState: { user: unknown } = { user: null };
vi.mock('../../auth/useAuth', () => ({ useAuth: () => authState }));

import { useAppVisible } from '../useAppVisibility';

/** A minimal feature app whose primary resource is `<id-singular>`. */
function app(id: string, singular: string): AppConfig {
  return {
    id,
    name: id,
    resources: [{ singular } as never],
  } as unknown as AppConfig;
}

// The open-household default: everyone may read everything. A block subtracts
// from this baseline, so tests compose it with the deny under test.
const ALL_ALLOW = {
  subject: { type: 'everyone' as const },
  capability: 'read' as const,
  effect: 'allow' as const,
  target: { scope: 'all' as const },
};

function ctxWith(grants: PermissionContext['grants']): PermissionContext {
  return { enforced: true, groupIds: [], groupNames: [], grants: [ALL_ALLOW, ...grants] };
}

const RECIPES = app('recipes', 'recipe');
const TODOS = app('todos', 'todo');

describe('useAppVisible + app-scope deny', () => {
  beforeEach(() => {
    authState.user = null;
  });

  it('hides an app the caller is app-scope denied, but not others', () => {
    authState.user = {
      id: 'u1',
      type: 'user',
      permissions: ctxWith([
        {
          subject: { type: 'user', id: 'u1' },
          capability: 'manage',
          effect: 'deny',
          target: { scope: 'app', app: 'recipes' },
        },
      ]),
    };
    const { result } = renderHook(() => useAppVisible());
    expect(result.current(RECIPES)).toBe(false); // blocked
    expect(result.current(TODOS)).toBe(true); // unaffected
  });

  it('shows the app when there is no block', () => {
    authState.user = { id: 'u1', type: 'user', permissions: ctxWith([]) };
    const { result } = renderHook(() => useAppVisible());
    expect(result.current(RECIPES)).toBe(true);
  });
});
