import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  getAllMigrations,
  initializeAppRegistry,
  resetAppRegistry,
} from '../registry';
import { logger } from '../../utils/logger';
import type { AppConfig, MigrationHandler } from '../types';

const noop: MigrationHandler = async () => {};

function app(
  id: string,
  migrations: AppConfig['migrations'],
  children?: AppConfig[],
): AppConfig {
  return { id, name: id, description: `${id} test app`, migrations, children };
}

afterEach(() => {
  resetAppRegistry();
  vi.restoreAllMocks();
});

describe('getAllMigrations', () => {
  test('collects migrations across apps in declaration order, tagged with the app id', () => {
    initializeAppRegistry([
      app('alpha', [
        { id: 'a1', load: async () => ({ default: noop }) },
        { id: 'a2', title: 'Second', load: async () => ({ default: noop }) },
      ]),
      app('beta', [
        { id: 'b1', destructive: true, load: async () => ({ default: noop }) },
      ]),
    ]);

    const migrations = getAllMigrations();
    expect(migrations.map((m) => [m.appId, m.id])).toEqual([
      ['alpha', 'a1'],
      ['alpha', 'a2'],
      ['beta', 'b1'],
    ]);
    expect(migrations[1].title).toBe('Second');
    expect(migrations[2].destructive).toBe(true);
  });

  test('walks nested children', () => {
    initializeAppRegistry([
      app('parent', undefined, [
        app('child', [{ id: 'c1', load: async () => ({ default: noop }) }]),
      ]),
    ]);

    expect(getAllMigrations().map((m) => [m.appId, m.id])).toEqual([['child', 'c1']]);
  });

  test('drops a migration whose id collides with one already seen, with a warning', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    initializeAppRegistry([
      app('alpha', [{ id: 'dup', load: async () => ({ default: noop }) }]),
      app('beta', [{ id: 'dup', load: async () => ({ default: noop }) }]),
    ]);

    const migrations = getAllMigrations();
    expect(migrations.map((m) => m.appId)).toEqual(['alpha']);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate migration id "dup"'),
      expect.anything(),
    );
  });

  test('returns an empty list when no app declares a migration', () => {
    initializeAppRegistry([app('alpha', undefined)]);
    expect(getAllMigrations()).toEqual([]);
  });
});
