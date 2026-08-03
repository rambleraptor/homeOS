import { afterEach, describe, expect, test, vi } from 'vitest';
import { createLogger } from '../src/log';

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.HOMESTEAD_LOG_LEVEL;
    delete process.env.HOMESTEAD_LOG_FORMAT;
  });

  test('default level is info: debug is dropped, info is kept', () => {
    const out = vi.spyOn(console, 'log').mockImplementation(() => {});
    const log = createLogger('t');
    log.debug('nope');
    log.info('yep');
    expect(out).toHaveBeenCalledTimes(1);
    expect(String(out.mock.calls[0]![0])).toContain('[t] yep');
  });

  test('the level threshold drops anything below it', () => {
    process.env.HOMESTEAD_LOG_LEVEL = 'warn';
    const out = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = createLogger('t');
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');
    expect(out).not.toHaveBeenCalled(); // debug + info dropped
    expect(warn).toHaveBeenCalledTimes(1); // warn → console.warn
    expect(err).toHaveBeenCalledTimes(1); // error → console.error
  });

  test('json format emits structured fields and serializes Errors', () => {
    process.env.HOMESTEAD_LOG_FORMAT = 'json';
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    createLogger('svc').error('boom', { code: 500, err: new Error('kaboom') });
    const parsed = JSON.parse(String(err.mock.calls[0]![0])) as Record<string, unknown>;
    expect(parsed).toMatchObject({ level: 'error', scope: 'svc', msg: 'boom', code: 500 });
    expect(String(parsed.err)).toContain('kaboom');
  });

  test('child() appends a sub-scope', () => {
    const out = vi.spyOn(console, 'log').mockImplementation(() => {});
    createLogger('a').child('b').info('hi');
    expect(String(out.mock.calls[0]![0])).toContain('[a:b]');
  });
});
