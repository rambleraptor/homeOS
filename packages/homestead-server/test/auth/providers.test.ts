/**
 * External-auth provider factory: descriptor → authenticator mapping and the
 * unknown-provider guard.
 */

import { describe, expect, it } from 'vitest';
import type { ExternalAuthConfig } from '@rambleraptor/homestead-core/apps/config';
import { buildAuthenticators } from '../../src/auth/providers';

describe('buildAuthenticators', () => {
  it('returns an empty chain when nothing is configured', () => {
    expect(buildAuthenticators()).toEqual([]);
    expect(buildAuthenticators([])).toEqual([]);
  });

  it('builds one authenticator per descriptor, in order', () => {
    const authenticators = buildAuthenticators([
      { provider: 'cloudflare-access', teamDomain: 'acme', aud: 'aud-1' },
    ]);
    expect(authenticators.map((a) => a.name)).toEqual(['cloudflare-access']);
  });

  it('throws on an unknown provider', () => {
    expect(() =>
      buildAuthenticators([{ provider: 'nope' } as unknown as ExternalAuthConfig]),
    ).toThrow(/unknown external auth provider: nope/);
  });
});
