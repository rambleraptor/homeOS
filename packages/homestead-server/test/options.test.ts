import { describe, expect, test } from 'vitest';
import { isServerPath } from '../src/options';

describe('isServerPath', () => {
  test('claims server-owned prefixes, bare and nested', () => {
    expect(isServerPath('/api/aep/users')).toBe(true);
    expect(isServerPath('/oauth')).toBe(true);
    expect(isServerPath('/oauth/google/start')).toBe(true);
    expect(isServerPath('/health')).toBe(true);
    expect(isServerPath('/health/live')).toBe(true);
  });

  test('leaves SPA routes alone, including ones sharing a prefix string', () => {
    expect(isServerPath('/')).toBe(false);
    expect(isServerPath('/recipes')).toBe(false);
    // A bare prefix must not swallow sibling routes: the health app lives at
    // /health-records while /health stays the server readiness probe.
    expect(isServerPath('/health-records')).toBe(false);
    expect(isServerPath('/oauth-help')).toBe(false);
    expect(isServerPath('/apis')).toBe(false);
  });
});
