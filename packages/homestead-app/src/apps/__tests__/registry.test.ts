/**
 * Tests for the app registry's flag aggregation, in particular the
 * auto-injected built-in `enabled` flag that every app receives —
 * including nested children, so each can be gated independently.
 *
 * Imports through the frontend's shim (`@/apps/registry`) so the
 * singleton is initialized from the real `homestead.config.ts`. The
 * assertions are integration-flavored — they walk the actual operator
 * app list rather than a synthetic one.
 */

import { describe, it, expect } from 'vitest';
import {
  getAllAppFlagDefs,
  getAppById,
  getNavigationApps,
  getTopBarApps,
  appRegistry,
  BUILTIN_ENABLED_FLAG_KEY,
  BUILTIN_ENABLED_TAGS_FLAG_KEY,
} from '@/apps/registry';
import { APP_VISIBILITY_OPTIONS } from '@rambleraptor/homestead-core/settings/visibility';
import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';

function collectAllIds(mods: AppConfig[]): string[] {
  const out: string[] = [];
  const visit = (m: AppConfig) => {
    out.push(m.id);
    for (const c of m.children ?? []) visit(c);
  };
  for (const m of mods) visit(m);
  return out;
}

describe('getAllAppFlagDefs', () => {
  it('injects an `enabled` enum flag into every registered app, including nested children', () => {
    const defs = getAllAppFlagDefs();
    const allIds = collectAllIds(appRegistry.apps);
    expect(Object.keys(defs).sort()).toEqual(allIds.sort());
    for (const id of allIds) {
      const flag = defs[id][BUILTIN_ENABLED_FLAG_KEY];
      expect(flag).toBeDefined();
      expect(flag.type).toBe('enum');
      if (flag.type === 'enum') {
        expect(flag.options).toEqual(APP_VISIBILITY_OPTIONS);
      }
    }
  });

  it("honors each app's `defaultEnabled` for the injected flag's default", () => {
    const defs = getAllAppFlagDefs();
    const recipesFlag = defs.recipes[BUILTIN_ENABLED_FLAG_KEY];
    expect(recipesFlag.type).toBe('enum');
    if (recipesFlag.type === 'enum') {
      expect(recipesFlag.default).toBe('superusers');
    }
  });

  it("defaults apps without `defaultEnabled` to 'all'", () => {
    const defs = getAllAppFlagDefs();
    const dashboardFlag = defs.dashboard[BUILTIN_ENABLED_FLAG_KEY];
    expect(dashboardFlag.type).toBe('enum');
    if (dashboardFlag.type === 'enum') {
      expect(dashboardFlag.default).toBe('all');
    }
  });

  it('preserves app-declared flags alongside the built-in one', () => {
    const defs = getAllAppFlagDefs();
    // `groceries.default_store` is an app-declared flag; it should
    // still be present after the built-in is merged in.
    expect(defs.groceries.default_store).toBeDefined();
    expect(defs.groceries[BUILTIN_ENABLED_FLAG_KEY]).toBeDefined();
  });

  it('injects an `enabled_tags` string flag into every app for tag-based gating', () => {
    const defs = getAllAppFlagDefs();
    const allIds = collectAllIds(appRegistry.apps);
    for (const id of allIds) {
      const flag = defs[id][BUILTIN_ENABLED_TAGS_FLAG_KEY];
      expect(flag).toBeDefined();
      expect(flag.type).toBe('string');
      if (flag.type === 'string') {
        expect(flag.default).toBe('');
      }
    }
  });

  it('inherits the parent audience for nested superuser-only children', () => {
    const defs = getAllAppFlagDefs();
    for (const childId of ['users', 'flag-management']) {
      const flag = defs[childId][BUILTIN_ENABLED_FLAG_KEY];
      expect(flag.type).toBe('enum');
      if (flag.type === 'enum') {
        expect(flag.default).toBe('superusers');
      }
    }
  });
});

describe('top-bar placement', () => {
  it('keeps topbar apps out of the sidebar navigation', () => {
    const navIds = getNavigationApps().map((m) => m.id);
    expect(navIds).not.toContain('notifications');
    expect(navIds).not.toContain('chat');
    expect(navIds).toContain('groceries');
  });

  it('returns topbar apps in navOrder', () => {
    const topBarIds = getTopBarApps().map((m) => m.id);
    expect(topBarIds).toEqual(['notifications', 'chat']);
  });

  it('registers chat as an always-installed core app', () => {
    expect(getAppById('chat')?.web?.basePath).toBe('/chat');
  });
});

describe('getAppById', () => {
  it('resolves top-level apps', () => {
    expect(getAppById('games')?.name).toBe('Games');
  });

  it('resolves nested children so flag UIs can render their names', () => {
    expect(getAppById('minigolf')?.name).toBe('Mini Golf');
    expect(getAppById('flag-management')?.name).toBe('Flag Management');
  });

  it('returns undefined for unknown ids', () => {
    expect(getAppById('does-not-exist')).toBeUndefined();
  });
});
