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
   * `https://home.example.com/api/v1/aep`. Each provider's redirect URL is
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
 * AI provider to use for this instance. Each maps to a Vercel AI SDK
 * provider package (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`).
 */
export type AiProvider = 'openai' | 'anthropic' | 'google';

/** Credentials for the configured AI provider. */
export interface AiAuthConfig {
  /**
   * Provider API key. Server-side only — read (typically from an env var) when
   * the launcher evaluates this config; it must never reach the browser bundle,
   * exactly like OAuth `clientSecret`.
   */
  apiKey: string;
}

/**
 * AI/LLM configuration for this instance. Consumed by the server (not the SPA
 * bundle) to power the chat assistant and the image-extraction custom methods.
 * Omit it to disable AI features entirely — those endpoints then return 503.
 */
export interface AiConfig {
  /** Which provider package to instantiate. */
  provider: AiProvider;
  /**
   * Model id for the chosen provider, e.g. `gpt-4o`,
   * `claude-3-5-sonnet-latest`, `gemini-2.5-flash`. Must be vision-capable for
   * the grocery/HSA image methods to work.
   */
  model: string;
  /** Provider credentials. */
  auth: AiAuthConfig;
}

/**
 * Shape of the user-supplied configuration consumed by the registry.
 * Operators declare their instance by exporting a value of this type
 * from `homestead.config.ts` at the repo root.
 */
export interface HomesteadConfig {
  /**
   * Apps wired in explicitly — npm-installed apps, or local apps the
   * operator prefers to list by hand. Order is preserved for any
   * use-cases that care; the registry sorts by `navOrder` for nav.
   *
   * Apps under the project's `apps/` directory that ship an
   * `app.homestead.ts` are discovered automatically and added on top
   * of this list (an explicit entry wins on an id collision), so a
   * pure-discovery project can omit this entirely.
   */
  apps?: AppConfig[];

  /**
   * Optional auth configuration. Consumed by the `homestead` launcher (not the
   * SPA bundle) to configure aepbase. Secrets are read from the environment
   * when the launcher evaluates this file server-side.
   */
  auth?: AuthConfig;

  /**
   * Optional AI configuration (provider, model, credentials). Consumed by the
   * server (not the SPA bundle). Omit to disable AI features — the chat and
   * image-extraction endpoints then return 503. The API key is read from the
   * environment when the launcher evaluates this file server-side, so it never
   * lands in the client bundle.
   */
  ai?: AiConfig;
}
