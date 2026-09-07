/**
 * The `homestead:discovered-apps` Vite plugin re-implements the app-directory
 * lookup that `homestead-core/server/app-discovery` owns, because Vite
 * externalizes workspace packages while loading a config file. These tests
 * hold the two implementations to the same answers — if one gains a rule, the
 * other has to as well, or discovery would disagree between the SPA bundle and
 * the server that serves it.
 */

import { describe, expect, test } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import {
  appsDirs,
  discoveredAppFiles,
} from '@rambleraptor/homestead-core/server/app-discovery';
import {
  appConfigFiles,
  projectAppsDirs,
  renderDiscoveredAppsModule,
} from '../../../vite/discovered-apps';

/** A throwaway project: `<root>/<dir>/<app>/app.homestead.ts` for each entry. */
function project(tree: Record<string, string[]>): string {
  const root = mkdtempSync(join(tmpdir(), 'homestead-discovery-'));
  for (const [dir, apps] of Object.entries(tree)) {
    for (const app of apps) {
      mkdirSync(join(root, dir, app), { recursive: true });
      writeFileSync(join(root, dir, app, 'app.homestead.ts'), 'export default {};\n');
    }
  }
  return root;
}

const ENVS: Record<string, NodeJS.ProcessEnv> = {
  'no override': {},
  'single dir': { HOMESTEAD_APPS_DIR: 'custom-apps' },
  'dir list': { HOMESTEAD_APPS_DIRS: `apps${delimiter}custom-apps` },
  'list wins over single': {
    HOMESTEAD_APPS_DIRS: `custom-apps${delimiter}apps`,
    HOMESTEAD_APPS_DIR: 'ignored',
  },
  'absolute and duplicate entries': {
    HOMESTEAD_APPS_DIRS: `apps${delimiter} ${delimiter}apps`,
  },
};

describe('discovered-apps plugin matches homestead-core app discovery', () => {
  for (const [name, env] of Object.entries(ENVS)) {
    test(name, () => {
      const root = project({ apps: ['alpha', 'beta'], 'custom-apps': ['gamma'] });
      try {
        const dirs = projectAppsDirs(root, env);
        expect(dirs).toEqual(appsDirs(env, root));
        expect(appConfigFiles(dirs)).toEqual(discoveredAppFiles(dirs));
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }
});

describe('renderDiscoveredAppsModule', () => {
  test('imports every config, dirs in order and apps sorted within each', () => {
    const root = project({ apps: ['beta', 'alpha'], extra: ['gamma'] });
    try {
      const code = renderDiscoveredAppsModule([join(root, 'extra'), join(root, 'apps')]);
      expect(code).toContain(`import * as app0 from "${join(root, 'extra', 'gamma', 'app.homestead.ts')}"`);
      expect(code).toContain(`import * as app1 from "${join(root, 'apps', 'alpha', 'app.homestead.ts')}"`);
      expect(code).toContain(`import * as app2 from "${join(root, 'apps', 'beta', 'app.homestead.ts')}"`);
      // The default export pairs each path with its module, in the same order.
      expect(code.match(/\[".*?", app\d\]/g)).toHaveLength(3);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('yields an empty list when no app directory exists', () => {
    const code = renderDiscoveredAppsModule([join(tmpdir(), 'homestead-no-such-dir')]);
    expect(code.trim()).toBe('export default [\n\n];');
  });
});
