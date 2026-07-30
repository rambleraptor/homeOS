/**
 * Resource-server helpers: validate an OAuth access token (optionally checking
 * the audience it was issued for) and build the RFC 6750 `401` a resource
 * server returns to send a client to discovery. Any Homestead resource server
 * that trusts AS-issued tokens uses these.
 */

import type { Database } from '../../engine/sqlite';
import type { User } from '../../engine/types';
import { extractBearerToken, getTokenRecord, getUserById } from '../../engine/users';
import { getAccessTokenBinding } from '../storage';
import { isExpired } from '../tokens';

export interface VerifiedToken {
  token: string;
  user: User;
  scope: string | null;
}

/**
 * Resolve a request's bearer token to its user, enforcing expiry and, when
 * `audience` is given, that the token was issued for that resource (RFC 8707).
 * Returns null on any failure. Only tokens the AS issued (present in
 * `_auth_access_tokens`) are honored when an audience is required — a plain
 * login token has no audience binding and is rejected for a scoped resource.
 */
export function verifyAccessToken(
  db: Database,
  req: Request,
  opts: { audience?: string } = {},
): VerifiedToken | null {
  const token = extractBearerToken(req);
  if (!token) return null;

  const rec = getTokenRecord(db, token);
  if (!rec || isExpired(rec.expires_at)) return null;

  const binding = getAccessTokenBinding(db, token);
  if (opts.audience) {
    // A scoped resource requires an audience-bound AS token matching it.
    if (!binding || binding.audience !== opts.audience) return null;
  }

  const user = getUserById(db, rec.user_id)?.user;
  if (!user) return null;
  return { token, user, scope: binding?.scope ?? null };
}

/** The RFC 6750 challenge value pointing a client at protected-resource metadata. */
export function wwwAuthenticate(issuerUrl: string, resourcePath: string): string {
  const issuer = issuerUrl.replace(/\/+$/, '');
  return `Bearer resource_metadata="${issuer}/.well-known/oauth-protected-resource${resourcePath}"`;
}

/** A ready-made `401` for a resource server, carrying the discovery pointer. */
export function unauthorizedResponse(issuerUrl: string, resourcePath: string): Response {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': wwwAuthenticate(issuerUrl, resourcePath),
    },
  });
}
