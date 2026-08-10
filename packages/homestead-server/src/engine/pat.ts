/**
 * Personal access token (PAT) secret handling.
 *
 * A PAT secret is shown to the user exactly once at mint time; only a hash of
 * it is stored, so a database read can't recover a usable token. Login/OAuth
 * tokens live in `_tokens` as their raw random value (looked up by the value
 * itself); PATs instead store `sha256(secret)` as the `_tokens.token` primary
 * key. `patLookupKey` reconciles the two: a presented value that looks like a
 * PAT secret is hashed before the lookup, everything else is used verbatim, so
 * the engine's single `WHERE token = ?` query keeps working for both.
 */

import { createHash, randomBytes } from 'node:crypto';

/** Distinguishes PAT secrets from raw session tokens (64-char hex). */
export const PAT_SECRET_PREFIX = 'hsd_pat_';

/** True if `value` is shaped like a PAT secret this build issues. */
export function isPatSecret(value: string): boolean {
  return value.startsWith(PAT_SECRET_PREFIX);
}

/** Mint a fresh, user-visible PAT secret: `hsd_pat_<64 hex>`. */
export function generatePatSecret(): string {
  return PAT_SECRET_PREFIX + randomBytes(32).toString('hex');
}

/** The stored/at-rest form of a PAT secret (its lookup key in `_tokens`). */
export function hashPatSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/**
 * The `_tokens.token` lookup key for a presented bearer value: PAT secrets are
 * hashed (they're stored hashed), any other token is looked up as-is.
 */
export function patLookupKey(presented: string): string {
  return isPatSecret(presented) ? hashPatSecret(presented) : presented;
}

/**
 * A short, non-secret display prefix for a minted secret (e.g. `hsd_pat_ab12cd…`),
 * safe to store on the readable PAT record so the UI can identify a token
 * without revealing it.
 */
export function patDisplayPrefix(secret: string): string {
  return secret.slice(0, PAT_SECRET_PREFIX.length + 6);
}
