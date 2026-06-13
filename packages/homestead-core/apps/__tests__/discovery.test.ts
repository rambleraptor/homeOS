import { describe, expect, test, vi } from 'vitest';
import { assertDiscoveredApp, mergeDiscoveredApps } from '../discovery';
import { logger } from '../../utils/logger';
import type { AppConfig } from '../types';

function app(id: string): AppConfig {
  return {
    id,
    name: id,
    description: `${id} test app`,
    icon: () => import('lucide-react').then((m) => m.Package),
    basePath: `/${id}`,
    routes: [],
  };
}

describe('assertDiscoveredApp', () => {
  test('returns the default export when it looks like an AppConfig', () => {
    const alpha = app('alpha');
    expect(assertDiscoveredApp({ default: alpha }, 'apps/alpha/app.homestead.ts')).toBe(alpha);
  });

  test('rejects a module without a default export, naming the file', () => {
    expect(() =>
      assertDiscoveredApp({ alphaApp: app('alpha') }, 'apps/alpha/app.homestead.ts'),
    ).toThrow(/apps\/alpha\/app\.homestead\.ts must default-export/);
  });

  test('rejects a default export that is not an AppConfig', () => {
    for (const bad of [null, 'alpha', { id: 'alpha' }, { basePath: '/alpha' }]) {
      expect(() =>
        assertDiscoveredApp({ default: bad }, 'apps/alpha/app.homestead.ts'),
      ).toThrow(/not an AppConfig/);
    }
  });
});

describe('mergeDiscoveredApps', () => {
  test('appends discovered apps after the explicit list', () => {
    const explicit = [app('todos')];
    const discovered = [app('alpha'), app('beta')];
    expect(mergeDiscoveredApps(explicit, discovered).map((m) => m.id)).toEqual([
      'todos',
      'alpha',
      'beta',
    ]);
  });

  test('explicit config entry wins an id collision, with a warning', () => {
    const explicitAlpha = app('alpha');
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    try {
      const merged = mergeDiscoveredApps([explicitAlpha], [app('alpha'), app('beta')]);
      expect(merged.map((m) => m.id)).toEqual(['alpha', 'beta']);
      expect(merged[0]).toBe(explicitAlpha);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('"alpha"'),
        expect.objectContaining({ appId: 'alpha' }),
      );
    } finally {
      warn.mockRestore();
    }
  });

  test('handles an empty explicit list (pure-discovery project)', () => {
    expect(mergeDiscoveredApps([], [app('alpha')]).map((m) => m.id)).toEqual(['alpha']);
  });

  test('does not mutate its inputs', () => {
    const explicit = [app('todos')];
    const discovered = [app('alpha')];
    mergeDiscoveredApps(explicit, discovered);
    expect(explicit).toHaveLength(1);
    expect(discovered).toHaveLength(1);
  });
});
