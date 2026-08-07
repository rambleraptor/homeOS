/**
 * Build live {@link RequestAuthenticator}s from the plain-data
 * {@link ExternalAuthConfig} descriptors an operator declares in
 * `homestead.config.ts`. This is the one place that knows the mapping from a
 * `provider` discriminator to its implementation — the same narrow-on-provider
 * pattern the email provider factory uses. Add a provider by adding a case here
 * and an {@link ExternalAuthConfig} member.
 */

import type { AuthServerConfig, ExternalAuthConfig } from '@rambleraptor/homestead-core/apps/config';
import { cloudflareAccessAuthenticator } from './access-jwt';
import type { RequestAuthenticator } from './authenticator';

/** Instantiate one authenticator from its descriptor. */
function buildAuthenticator(cfg: ExternalAuthConfig): RequestAuthenticator {
  switch (cfg.provider) {
    case 'cloudflare-access':
      return cloudflareAccessAuthenticator(cfg);
    default:
      // Exhaustiveness guard: a new union member without a case is a type error
      // here, and an unknown provider at runtime fails fast rather than silently
      // authenticating no one.
      throw new Error(
        `unknown external auth provider: ${(cfg as { provider: string }).provider}`,
      );
  }
}

/**
 * Normalize an {@link AuthServerConfig} to its ordered list of external-auth
 * descriptors, folding the deprecated `cloudflareAccess` field into the
 * {@link ExternalAuthConfig} union (unless an equivalent entry is already in
 * `externalAuth`). Callers pass the result to {@link buildAuthenticators}.
 */
export function externalAuthConfigs(cfg: AuthServerConfig): ExternalAuthConfig[] {
  const configs = [...(cfg.externalAuth ?? [])];
  if (cfg.cloudflareAccess && !configs.some((c) => c.provider === 'cloudflare-access')) {
    configs.push({ provider: 'cloudflare-access', ...cfg.cloudflareAccess });
  }
  return configs;
}

/** Build the ordered authenticator chain from a list of descriptors. */
export function buildAuthenticators(configs: ExternalAuthConfig[]): RequestAuthenticator[] {
  return configs.map(buildAuthenticator);
}
