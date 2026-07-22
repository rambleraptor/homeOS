import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  getAllCronHooks,
  initializeAppRegistry,
  resetAppRegistry,
} from '../registry';
import { logger } from '../../utils/logger';
import type { AppConfig, CronHandler } from '../types';

const noop: CronHandler = async () => {};

function app(id: string, crons: AppConfig['crons'], children?: AppConfig[]): AppConfig {
  return { id, name: id, description: `${id} test app`, crons, children };
}

afterEach(() => {
  resetAppRegistry();
  vi.restoreAllMocks();
});

describe('getAllCronHooks', () => {
  test('collects hooks across apps, tagged with the owning app id', () => {
    initializeAppRegistry([
      app('alpha', [{ id: 'a1', intervalSeconds: 60, load: async () => ({ default: noop }) }]),
      app('beta', [
        { id: 'b1', intervalSeconds: 30, runOnStart: true, load: async () => ({ default: noop }) },
      ]),
    ]);

    const hooks = getAllCronHooks();
    expect(hooks.map((h) => [h.appId, h.id, h.intervalSeconds])).toEqual([
      ['alpha', 'a1', 60],
      ['beta', 'b1', 30],
    ]);
    expect(hooks[1].runOnStart).toBe(true);
  });

  test('walks nested children', () => {
    initializeAppRegistry([
      app('parent', undefined, [
        app('child', [{ id: 'c1', intervalSeconds: 120, load: async () => ({ default: noop }) }]),
      ]),
    ]);

    expect(getAllCronHooks().map((h) => [h.appId, h.id])).toEqual([['child', 'c1']]);
  });

  test('drops a hook whose id collides with one already seen, with a warning', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    initializeAppRegistry([
      app('alpha', [{ id: 'dup', intervalSeconds: 60, load: async () => ({ default: noop }) }]),
      app('beta', [{ id: 'dup', intervalSeconds: 90, load: async () => ({ default: noop }) }]),
    ]);

    const hooks = getAllCronHooks();
    expect(hooks.map((h) => h.appId)).toEqual(['alpha']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Duplicate cron hook id "dup"'), expect.anything());
  });

  test('drops a hook with a non-positive interval, with a warning', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    initializeAppRegistry([
      app('alpha', [
        { id: 'zero', intervalSeconds: 0, load: async () => ({ default: noop }) },
        { id: 'neg', intervalSeconds: -5, load: async () => ({ default: noop }) },
        { id: 'ok', intervalSeconds: 15, load: async () => ({ default: noop }) },
      ]),
    ]);

    expect(getAllCronHooks().map((h) => h.id)).toEqual(['ok']);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  test('returns an empty list when no app declares a hook', () => {
    initializeAppRegistry([app('alpha', undefined)]);
    expect(getAllCronHooks()).toEqual([]);
  });
});
