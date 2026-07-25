/**
 * Email provider configuration for the server.
 *
 * The operator declares an `email` block in homestead.config.ts (provider +
 * credentials). The server reads it via `registry.emailConfig()` at startup and
 * pushes it here with {@link setEmailConfig} — core can't import the server's
 * registry (the dependency direction is server → core), so the server hands the
 * config down, exactly like `setAiConfig`. Consumers resolve the live provider
 * through {@link getEmailProvider} rather than constructing one themselves.
 *
 * The constructed provider is memoized so its cached OAuth access token survives
 * across calls (the ingestion cron fires every 5 minutes; a Gmail access token
 * lives ~1h). The instance is rebuilt only when {@link setEmailConfig} installs
 * a different config.
 */

import type { EmailConfig } from '../../apps/config';
import { EmailProvider } from './types';
import { GmailProvider } from './gmail';

let current: EmailConfig | null = null;
let cached: EmailProvider | null = null;

/**
 * True when `cfg` carries usable credentials for its provider. Narrows on
 * `provider` so each provider validates its own credential shape — a new union
 * member adds a `case` here rather than widening a shared check.
 */
function hasCredentials(cfg: EmailConfig | null): cfg is EmailConfig {
  if (cfg === null) return false;
  switch (cfg.provider) {
    case 'gmail': {
      const { clientId, clientSecret, refreshToken } = cfg.auth;
      return (
        clientId.trim() !== '' &&
        clientSecret.trim() !== '' &&
        refreshToken.trim() !== ''
      );
    }
  }
}

/**
 * Install the instance's email config. Called once by the server at startup
 * with `registry.emailConfig()` (null when the operator omitted the `email`
 * block). Safe to call with `null` to leave email disabled. Clears the memoized
 * provider so the next {@link getEmailProvider} rebuilds it.
 */
export function setEmailConfig(config: EmailConfig | null): void {
  current = config;
  cached = null;
}

/** The active email config, or null when email is unconfigured. */
export function getEmailConfig(): EmailConfig | null {
  return current;
}

/**
 * True when an email provider is configured with usable credentials. A blank
 * refresh token / client id / secret (e.g. the env var it reads in
 * homestead.config.ts is unset) counts as unconfigured, so callers can no-op
 * cleanly instead of failing mid-run.
 */
export function isEmailConfigured(): boolean {
  return hasCredentials(current);
}

/** Thrown by {@link getEmailProvider} when no email provider is configured. */
export class EmailNotConfiguredError extends Error {
  constructor() {
    super('Email is not configured on the server');
    this.name = 'EmailNotConfiguredError';
  }
}

/**
 * The configured {@link EmailProvider}, constructed once and memoized. Throws
 * {@link EmailNotConfiguredError} when email is unconfigured — callers should
 * gate on {@link isEmailConfigured} first.
 */
export function getEmailProvider(): EmailProvider {
  const cfg = current;
  if (!hasCredentials(cfg)) throw new EmailNotConfiguredError();
  if (cached) return cached;
  switch (cfg.provider) {
    case 'gmail':
      cached = new GmailProvider(cfg.auth, cfg.user);
      return cached;
  }
}
