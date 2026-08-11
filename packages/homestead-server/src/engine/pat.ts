/**
 * Token secret handling.
 *
 * Every bearer secret — session/login/OAuth access tokens, admin mints, and
 * personal access tokens (PATs) — is stored in `_tokens` only as its hash, so a
 * database read can't recover a usable token. `hashToken` is the single at-rest
 * transform: `insertToken` applies it before writing, and every lookup applies
 * it to the presented value before the `WHERE token = ?` compare. A PAT secret
 * carries a human-recognizable prefix (so the UI can label it) but is hashed
 * exactly like any other token.
 */

import { createHash, randomBytes } from 'node:crypto';

/** Marks a PAT secret so the UI can show a recognizable, non-secret prefix. */
export const PAT_SECRET_PREFIX = 'hsd_pat_';

/** Mint a fresh, user-visible PAT secret: `hsd_pat_<64 hex>`. */
export function generatePatSecret(): string {
  return PAT_SECRET_PREFIX + randomBytes(32).toString('hex');
}

/**
 * The at-rest form of any bearer token: `sha256(raw)`. Applied on insert and on
 * every lookup, so `_tokens` never holds a usable secret. sha256 (not a slow
 * KDF) is sufficient here because tokens carry 256 bits of entropy — brute
 * force is infeasible regardless of hash speed.
 */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * A short, non-secret display prefix for a minted secret (e.g. `hsd_pat_ab12cd…`),
 * safe to store on the readable PAT record so the UI can identify a token
 * without revealing it.
 */
export function patDisplayPrefix(secret: string): string {
  return secret.slice(0, PAT_SECRET_PREFIX.length + 6);
}
