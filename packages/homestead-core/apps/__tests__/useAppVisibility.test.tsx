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

/** A parent app that owns no collections of its own, wrapping child apps. */
function parentApp(id: string, children: AppConfig[]): AppConfig {
  return { id, name: id, children } as unknown as AppConfig;
}

/** An app-scope deny on `appId` for user `u1` (subtracts from the open baseline). */
function denyApp(appId: string) {
  return {
    subject: { type: 'user' as const, id: 'u1' },
    capability: 'manage' as const,
    effect: 'deny' as const,
    target: { scope: 'app' as const, app: appId },
  };
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

/** A closed household: no blanket allow, only the grants under test. */
function closedCtx(
  grants: PermissionContext['grants'],
  collectionsWithRows: string[] = [],
): PermissionContext {
  return { enforced: true, groupIds: [], groupNames: [], grants, collectionsWithRows };
}

/** An app that owns several collections, none of them first-and-only. */
function multiResourceApp(id: string, singulars: string[]): AppConfig {
  return {
    id,
    name: id,
    resources: singulars.map((singular) => ({ singular })),
  } as unknown as AppConfig;
}

/** An app with no collections and no children — Chat, Settings, Dashboard. */
function bareApp(id: string): AppConfig {
  return { id, name: id } as unknown as AppConfig;
}

/** A collection-scope allow on one resource. */
function allowCollection(userId: string, resourceType: string) {
  return {
    subject: { type: 'user' as const, id: userId },
    capability: 'read' as const,
    effect: 'allow' as const,
    target: { scope: 'collection' as const, resource_type: resourceType },
  };
}

/** An app-scope allow — the only thing that can reveal a collection-less app. */
function allowApp(userId: string, appId: string) {
  return {
    subject: { type: 'user' as const, id: userId },
    capability: 'read' as const,
    effect: 'allow' as const,
    target: { scope: 'app' as const, app: appId },
  };
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

describe('useAppVisible + nested apps', () => {
  const PICTIONARY = app('pictionary', 'pictionary-game');
  const MINIGOLF = app('minigolf', 'hole');
  const GAMES = parentApp('games', [PICTIONARY, MINIGOLF]);

  beforeEach(() => {
    authState.user = null;
  });

  it('shows a resource-less parent when at least one child is reachable', () => {
    authState.user = { id: 'u1', type: 'user', permissions: ctxWith([]) };
    const { result } = renderHook(() => useAppVisible());
    // Both children readable → parent (Games) visible.
    expect(result.current(GAMES)).toBe(true);
  });

  it('keeps the parent visible when only some children are blocked', () => {
    authState.user = {
      id: 'u1',
      type: 'user',
      permissions: ctxWith([denyApp('pictionary')]),
    };
    const { result } = renderHook(() => useAppVisible());
    expect(result.current(PICTIONARY)).toBe(false); // blocked child
    expect(result.current(MINIGOLF)).toBe(true); // still reachable
    expect(result.current(GAMES)).toBe(true); // parent surfaces via minigolf
  });

  it('hides the parent when every child is blocked', () => {
    authState.user = {
      id: 'u1',
      type: 'user',
      permissions: ctxWith([denyApp('pictionary'), denyApp('minigolf')]),
    };
    const { result } = renderHook(() => useAppVisible());
    expect(result.current(GAMES)).toBe(false);
  });
});


describe('useAppVisible + apps owning several collections', () => {
  // `documents` owns `collection` and `document`; gating on the first declared
  // one alone would hide the app from someone who can reach only the second.
  const DOCUMENTS = multiResourceApp('documents', ['collection', 'document']);

  beforeEach(() => {
    authState.user = null;
  });

  it('shows the app when any of its collections is reachable, not just the first', () => {
    authState.user = {
      id: 'u1',
      type: 'user',
      permissions: closedCtx([allowCollection('u1', 'document')]),
    };
    const { result } = renderHook(() => useAppVisible());
    expect(result.current(DOCUMENTS)).toBe(true);
  });

  it('hides the app when none of its collections is reachable', () => {
    authState.user = { id: 'u1', type: 'user', permissions: closedCtx([]) };
    const { result } = renderHook(() => useAppVisible());
    expect(result.current(DOCUMENTS)).toBe(false);
  });

  it('shows the app when the caller has rows behind a filtered grant', () => {
    // The real documents case: access comes from a filtered grant, which the
    // client resolver refuses to evaluate, so the grants alone say "no". The
    // server's row-existence report is what keeps the app in the sidebar.
    authState.user = {
      id: 'u1',
      type: 'user',
      permissions: closedCtx([], ['document']),
    };
    const { result } = renderHook(() => useAppVisible());
    expect(result.current(DOCUMENTS)).toBe(true);
  });

  it('hides it again once the caller has no rows left', () => {
    authState.user = { id: 'u1', type: 'user', permissions: closedCtx([], []) };
    const { result } = renderHook(() => useAppVisible());
    expect(result.current(DOCUMENTS)).toBe(false);
  });
});

describe('useAppVisible + apps with no collections', () => {
  const CHAT = bareApp('chat');

  beforeEach(() => {
    authState.user = null;
  });

  it('hides a collection-less app when nothing grants it', () => {
    // Closed by default: with no collections to gate on, only an app-scope
    // grant can reveal it.
    authState.user = { id: 'u1', type: 'user', permissions: closedCtx([]) };
    const { result } = renderHook(() => useAppVisible());
    expect(result.current(CHAT)).toBe(false);
  });

  it('shows it under an app-scope grant', () => {
    authState.user = {
      id: 'u1',
      type: 'user',
      permissions: closedCtx([allowApp('u1', 'chat')]),
    };
    const { result } = renderHook(() => useAppVisible());
    expect(result.current(CHAT)).toBe(true);
  });

  it('shows Settings to an account granted nothing at all', () => {
    // Settings manages your own preferences — gating it would leave a Guest
    // with no way to reach their own settings, and there is no household data
    // behind it.
    authState.user = { id: 'u1', type: 'user', permissions: closedCtx([]) };
    const { result } = renderHook(() => useAppVisible());
    expect(result.current(bareApp('settings'))).toBe(true);
    // …and it isn't a blanket exemption: Chat is still gated.
    expect(result.current(CHAT)).toBe(false);
  });

  it('shows it under a blanket grant, and hides it under an app-scope deny', () => {
    authState.user = { id: 'u1', type: 'user', permissions: ctxWith([]) };
    const { result } = renderHook(() => useAppVisible());
    expect(result.current(CHAT)).toBe(true);

    authState.user = { id: 'u1', type: 'user', permissions: ctxWith([denyApp('chat')]) };
    const { result: denied } = renderHook(() => useAppVisible());
    expect(denied.current(CHAT)).toBe(false);
  });
});
