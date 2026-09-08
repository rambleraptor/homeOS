import { describe, expect, test } from 'vitest';
import { delimiter, join } from 'node:path';
import { appDirsToWatch } from './supervisor.ts';

describe('appDirsToWatch', () => {
  test('defaults to <project>/apps', () => {
    expect(appDirsToWatch('/srv/home', {})).toEqual([join('/srv/home', 'apps')]);
  });

  test('uses every HOMESTEAD_APPS_DIRS entry, resolved against the project', () => {
    expect(
      appDirsToWatch('/srv/home', {
        HOMESTEAD_APPS_DIRS: `apps${delimiter} /srv/shared-apps `,
      }),
    ).toEqual(['/srv/home/apps', '/srv/shared-apps']);
  });

  test('drops blank entries and de-duplicates', () => {
    expect(
      appDirsToWatch('/srv/home', {
        HOMESTEAD_APPS_DIRS: `${delimiter}apps${delimiter}/srv/home/apps${delimiter}`,
      }),
    ).toEqual(['/srv/home/apps']);
  });

  test('falls back to <project>/apps when the list is empty', () => {
    expect(appDirsToWatch('/srv/home', { HOMESTEAD_APPS_DIRS: ` ${delimiter} ` })).toEqual([
      join('/srv/home', 'apps'),
    ]);
  });
});
