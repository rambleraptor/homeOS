import type { CliConfig } from './config-types.ts';

/**
 * Serialize `auth.oauth` into the value for the aepbase child's `AEPBASE_OAUTH`
 * env var, or `undefined` when OAuth is not configured (so the child leaves
 * OAuth disabled). Pure — no config loading — so it's unit-testable. This env
 * var is the only coupling point between the launcher and aepbase's OAuth.
 */
export function serializeOAuth(cfg: CliConfig): string | undefined {
  const oauth = cfg.auth?.oauth;
  if (!oauth || !oauth.providers?.length) return undefined;
  return JSON.stringify(oauth);
}
