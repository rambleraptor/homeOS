/**
 * External-auth provider factory: descriptor → authenticator mapping, the
 * deprecated `cloudflareAccess` alias folding, and the unknown-provider guard.
 */

import { describe, expect, it } from 'vitest';
import type {
  AuthServerConfig,
  ExternalAuthConfig,
} from '@rambleraptor/homestead-core/apps/config';
import { buildAuthenticators, externalAuthConfigs } from '../../src/auth/providers';

const BASE: AuthServerConfig = { enabled: true, issuerUrl: 'https://home.example.com' };

describe('externalAuthConfigs', () => {
  it('returns an empty list when nothing is configured', () => {
    expect(externalAuthConfigs(BASE)).toEqual([]);
  });

  it('passes through an explicit externalAuth list', () => {
    const externalAuth: ExternalAuthConfig[] = [
      { provider: 'cloudflare-access', teamDomain: 'acme', aud: 'aud-1' },
    ];
    expect(externalAuthConfigs({ ...BASE, externalAuth })).toEqual(externalAuth);
  });

  it('folds the deprecated cloudflareAccess alias into the list', () => {
    const configs = externalAuthConfigs({
      ...BASE,
      cloudflareAccess: { teamDomain: 'acme', aud: 'aud-1' },
    });
    expect(configs).toEqual([{ provider: 'cloudflare-access', teamDomain: 'acme', aud: 'aud-1' }]);
  });

  it('does not double-add the alias when externalAuth already has cloudflare-access', () => {
    const externalAuth: ExternalAuthConfig[] = [
      { provider: 'cloudflare-access', teamDomain: 'primary', aud: 'aud-1' },
    ];
    const configs = externalAuthConfigs({
      ...BASE,
      externalAuth,
      cloudflareAccess: { teamDomain: 'legacy', aud: 'aud-2' },
    });
    expect(configs).toEqual(externalAuth);
  });
});

describe('buildAuthenticators', () => {
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
