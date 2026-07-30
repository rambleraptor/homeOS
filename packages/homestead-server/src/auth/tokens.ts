/**
 * Small time helpers for the auth service. Access/refresh tokens carry an
 * RFC3339 UTC expiry (seconds precision, `Z` suffix — identical to the engine's
 * `create_time`), so lexicographic string comparison orders them correctly.
 */

/** Default access-token lifetime: 1 hour. */
export const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 60 * 60;

/** Default refresh-token lifetime: 30 days. */
export const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

/** An RFC3339 UTC timestamp `seconds` in the future, matching `nowRFC3339()`. */
export function expiryFromNow(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** True when an RFC3339 expiry (or null = never) is at or before now. */
export function isExpired(expiresAt: string | null): boolean {
  if (expiresAt === null) return false;
  return expiresAt <= new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}
