import type { AppConfig } from './types';

/**
 * One OAuth provider in {@link OAuthConfig}. Field names mirror the JSON the
 * launcher serializes into the aepbase child's `AEPBASE_OAUTH` env var.
 *
 * NOTE: `clientSecret` is server-side only. It is read (typically from an env
 * var) when the launcher evaluates this config under Bun; it must never be
 * surfaced to the browser. The SPA only consumes `name`/`displayName` to render
 * login buttons — it fetches the live provider list from aepbase, so a missing
 * secret in the browser bundle is harmless.
 */
export interface OAuthProviderConfig {
  /** Stable id; appears in the callback URL `/oauth/{name}/callback`. */
  name: string;
  /** Human label for the sign-in button (falls back to `name`). */
  displayName?: string;
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  /** Permit the callback to create a new account on first login. */
  allowRegistration?: boolean;
}

/** OAuth login configuration for this instance. */
export interface OAuthConfig {
  /**
   * Externally-reachable base URL mapping to the aepbase root, e.g.
   * `https://home.example.com/api/aep`. Each provider's redirect URL is
   * `{redirectBaseUrl}/oauth/{name}/callback`.
   */
  redirectBaseUrl: string;
  /**
   * SPA URL the OAuth callback returns to with the minted token in the URL
   * fragment, e.g. `https://home.example.com/auth/callback`.
   */
  successRedirect: string;
  providers: OAuthProviderConfig[];
}

/** Authentication configuration for this instance. */
export interface AuthConfig {
  /** OAuth login. Omit (or omit `providers`) to disable OAuth. */
  oauth?: OAuthConfig;
}

/**
 * Shape of the user-supplied configuration consumed by the registry.
 * Operators declare their instance by exporting a value of this type
 * from `homestead.config.ts` at the repo root.
 */
export interface HomesteadConfig {
  /**
   * Apps included in this instance. Order is preserved for any
   * use-cases that care; the registry sorts by `navOrder` for nav.
   */
  apps: AppConfig[];

  /**
   * Optional auth configuration. Consumed by the `homestead` launcher (not the
   * SPA bundle) to configure aepbase. Secrets are read from the environment
   * when the launcher evaluates this file server-side.
   */
  auth?: AuthConfig;
}
