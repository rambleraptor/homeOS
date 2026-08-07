/**
 * The pluggable request-authentication contract.
 *
 * An authenticator inspects an inbound `Request` and, if it recognizes and
 * verifies the caller, reports *who* they are — an email, plus an optional
 * subject and scope. It deliberately does **not** resolve a user or mint a
 * token: user lookup and token minting need the engine's db and stay in the
 * host route, so an authenticator never touches the database. This keeps a
 * provider free of engine coupling and makes the whole set trivially unit-
 * testable.
 *
 * Cloudflare Access is one authenticator (see `access-jwt.ts`); the host route
 * knows only this interface, so a new provider (an mTLS header, a Google IAP
 * JWT, Tailscale) is added without touching the route — one factory case in
 * `providers.ts` and one {@link ExternalAuthConfig} member.
 */

/** The identity an authenticator resolves an inbound request to. */
export interface AuthIdentity {
  /** Principal email — the host maps this to a Homestead user. */
  email: string;
  /** Optional stable subject id from the upstream IdP (a JWT `sub`, etc.). */
  subject?: string;
  /**
   * Granted scope, or null/undefined for unscoped (full read+write). Mirrors an
   * OAuth token's scope string; most gateway authenticators leave it unscoped.
   */
  scope?: string | null;
}

/** A pluggable request authenticator. Providers implement this. */
export interface RequestAuthenticator {
  /** Stable name, for logging/diagnostics (e.g. `cloudflare-access`). */
  readonly name: string;
  /**
   * Resolve the caller's identity, or `null` if this authenticator doesn't
   * authenticate the request (the host falls through to the next). Must NOT
   * throw for an unauthenticated request; reserve throwing for infrastructure
   * failures (e.g. a JWKS fetch failing).
   */
  authenticate(req: Request): Promise<AuthIdentity | null>;
}
