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

/**
 * Homestead-as-OAuth-provider configuration. When enabled, the instance runs
 * an OAuth 2.1 Authorization Server so third-party client apps can be
 * authorized against a household account (discovery metadata, dynamic client
 * registration, `/authorize` + consent, `/token` with PKCE). Distinct from
 * {@link OAuthConfig}, which is the opposite role (logging *in* to Homestead
 * via Google/GitHub). Server-side only. Omit to leave the AS disabled.
 */
export interface AuthServerConfig {
  /** Master switch. When false/absent, all AS + discovery routes are unmounted. */
  enabled: boolean;
  /**
   * Externally-reachable origin acting as the OAuth issuer and the base for
   * every metadata URL, e.g. `https://home.example.com`. Used verbatim (never
   * derived from the request) so it stays correct behind a reverse proxy.
   */
  issuerUrl: string;
  /** Scopes advertised in metadata. Defaults to a single broad `homestead` scope. */
  scopesSupported?: string[];
  /** Access-token lifetime in seconds (default 3600). */
  accessTokenTtlSeconds?: number;
  /** Refresh-token lifetime in seconds (default 30 days). */
  refreshTokenTtlSeconds?: number;
  /** Authorization-code lifetime in seconds (default 60). */
  authCodeTtlSeconds?: number;
  /**
   * Expose the first-party MCP server at `/api/mcp`. MCP clients authorize
   * through this authorization server, so it is on by default whenever the AS
   * is enabled; set false to run the AS without the MCP endpoint.
   */
  mcpEnabled?: boolean;
}

/** Authentication configuration for this instance. */
export interface AuthConfig {
  /** OAuth login (Homestead as client). Omit (or omit `providers`) to disable. */
  oauth?: OAuthConfig;
  /** OAuth authorization server (Homestead as provider). Omit to disable. */
  authServer?: AuthServerConfig;
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
  /**
   * Override the provider's API endpoint. Point this at any host speaking the
   * chosen provider's wire format — a self-hosted or proxied model (Ollama,
   * vLLM, LiteLLM) or a gateway. Omit to use the provider's default cloud
   * endpoint.
   */
  baseURL?: string;
}

/**
 * Providers that offer a text-embedding model. A subset of {@link AiProvider}:
 * Anthropic ships no embedding model, so it can't back embeddings even when it
 * backs the chat `ai` block — hence a separate provider union and config block.
 */
export type EmbeddingProvider = 'openai' | 'google';

/**
 * Embedding configuration for semantic search over file fields (`FieldDef.ai`).
 * Independent of the chat `ai` block on purpose — the two can use different
 * providers, and Anthropic (a valid `ai` provider) has no embedding model. Point
 * it at the same provider/key as `ai` if you like. Omit to disable embedding:
 * `embed`-flagged file fields then still extract text but aren't made
 * searchable, and the chat search tool isn't registered.
 */
export interface EmbeddingConfig {
  /** Which provider package to instantiate for embeddings. */
  provider: EmbeddingProvider;
  /**
   * Embedding model id, e.g. `text-embedding-3-small` (OpenAI) or
   * `text-embedding-004` (Google). A field may override this per-field via
   * `ai.embed.embedding_model`.
   */
  model: string;
  /** Provider credentials. Server-side only, like {@link AiConfig.auth}. */
  auth: AiAuthConfig;
  /** Override the provider's API endpoint. See {@link AiConfig.baseURL}. */
  baseURL?: string;
}

/**
 * Email provider to use for this instance. Only Gmail is implemented today; the
 * value discriminates the {@link EmailConfig} union, so a new provider (IMAP,
 * Microsoft Graph, …) is added as a new union member carrying its own
 * credential/connection fields — the generic parts of the config don't change.
 */
export type EmailProviderName = 'gmail';

/**
 * Fields common to every provider's email config. Provider-neutral on purpose:
 * anything Gmail-specific (OAuth credentials, the `userId` mailbox) lives on the
 * provider's own config member, not here.
 */
export interface EmailConfigBase {
  /**
   * Provider-specific search expression scoping which messages the documents
   * ingestion cron reads (and then trashes). Defaults to `'has:attachment'`.
   * Narrow it to a dedicated label/address (e.g. `'label:homestead
   * has:attachment'`) so only mail meant for ingestion is ever touched. The
   * *syntax* is the provider's (Gmail search here); the field itself is generic.
   */
  query?: string;
}

/**
 * Credentials for the Gmail provider. A long-lived OAuth **refresh token** for
 * one mailbox (obtained once via the Google OAuth consent flow), plus the
 * client id/secret used to exchange it for short-lived access tokens.
 *
 * Server-side only, exactly like {@link AiAuthConfig.apiKey} and OAuth
 * `clientSecret`: read from the environment when the launcher evaluates this
 * config server-side, never surfaced to the browser bundle.
 *
 * The refresh token must carry the scopes the features you use need:
 * `https://www.googleapis.com/auth/gmail.readonly` to read, plus
 * `.../gmail.modify` for the documents ingestion cron (it moves processed
 * messages to Trash) and `.../gmail.send` to send.
 */
export interface GmailAuthConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/**
 * Gmail-specific email configuration. The OAuth credentials and the mailbox
 * `user` are Gmail concepts and live only on this member of the
 * {@link EmailConfig} union — they are not part of the generic email config.
 */
export interface GmailConfig extends EmailConfigBase {
  provider: 'gmail';
  /** Gmail OAuth credentials. */
  auth: GmailAuthConfig;
  /**
   * Mailbox to operate on, in the Gmail API's `userId` form. Defaults to
   * `'me'` (the mailbox that owns the refresh token). Set it to an explicit
   * address only under Google Workspace domain-wide delegation.
   */
  user?: string;
}

/**
 * Email configuration for this instance — a discriminated union over
 * {@link EmailProviderName}. Consumed by the server (not the SPA bundle) to read
 * and send mail through a provider, and to power the documents app's
 * email-ingestion cron. Omit it to disable email entirely — the provider
 * factory then reports unconfigured and the ingestion cron no-ops.
 *
 * Adding a provider means adding a member (e.g. `GmailConfig | ImapConfig`); the
 * factory in `core/server/email/config.ts` narrows on `provider` to build the
 * matching {@link EmailProvider}.
 *
 * These are plain data types only: `homestead.config.ts` (which the SPA imports)
 * builds a value of this shape from env vars, so nothing here may reference the
 * server-only provider classes under `core/server/email`.
 */
export type EmailConfig = GmailConfig;

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

  /**
   * Optional embedding configuration (provider, model, credentials) for
   * semantic search over `ai.embed`-flagged file fields. Server-side only.
   * Omit to leave embedding disabled even when `ai` is set — text extraction
   * still runs, but nothing is indexed for search. See {@link EmbeddingConfig}.
   */
  embedding?: EmbeddingConfig;

  /**
   * Optional email configuration (provider + credentials). Consumed by the
   * server (not the SPA bundle) to read/send mail and to drive the documents
   * app's email-ingestion cron. Omit to disable email — the provider factory
   * reports unconfigured and the cron no-ops. Credentials are read from the
   * environment when the launcher evaluates this file server-side, so they
   * never land in the client bundle. See {@link EmailConfig}.
   */
  email?: EmailConfig;
}
