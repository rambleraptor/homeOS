import { afterEach, describe, expect, test } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  defaultAppsDir,
  discoverApps,
} from '@rambleraptor/homestead-core/server/app-discovery';

const FIXTURES = fileURLToPath(new URL('./fixtures', import.meta.url));

describe('discoverApps', () => {
  test('imports apps/*/app.homestead.ts sorted by directory name', async () => {
    const apps = await discoverApps(join(FIXTURES, 'discovery-apps'));
    expect(apps.map((m) => m.id)).toEqual(['alpha', 'beta']);
    expect(apps.map((m) => m.web?.basePath)).toEqual(['/alpha', '/beta']);
    // The not-an-app/ subdir (no app.homestead.ts) was skipped silently.
  });

  test('returns [] for a missing apps directory', async () => {
    expect(await discoverApps(join(FIXTURES, 'does-not-exist'))).toEqual([]);
  });

  test('throws (naming the file) when the default export is missing', async () => {
    await expect(
      discoverApps(join(FIXTURES, 'discovery-bad')),
    ).rejects.toThrow(/app\.homestead\.ts must default-export/);
  });
});

describe('defaultAppsDir', () => {
  const saved = process.env.HOMESTEAD_APPS_DIR;
  afterEach(() => {
    if (saved === undefined) delete process.env.HOMESTEAD_APPS_DIR;
    else process.env.HOMESTEAD_APPS_DIR = saved;
  });

  test('prefers HOMESTEAD_APPS_DIR, falling back to <cwd>/apps', () => {
    process.env.HOMESTEAD_APPS_DIR = '/tmp/somewhere/apps';
    expect(defaultAppsDir()).toBe('/tmp/somewhere/apps');
    delete process.env.HOMESTEAD_APPS_DIR;
    expect(defaultAppsDir()).toBe(join(process.cwd(), 'apps'));
  });
});
