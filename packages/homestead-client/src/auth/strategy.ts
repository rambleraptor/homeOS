import type { HomesteadUser, MaybePromise } from '../types';

/**
 * The minimal transport an {@link AuthStrategy} may need to perform its own
 * requests (e.g. a lazy password login). Handed to `attach` at client
 * construction so a strategy can reach the same base URL + fetch the client uses.
 */
export interface AuthTransport {
  /** Fully-qualified engine base, already including `/api/aep`. */
  baseUrl: string;
  fetch: typeof fetch;
}

/**
 * Pluggable authentication. This is the single seam that lets one CRUD core
 * serve every caller: the browser SPA (localStorage), server routes (a static
 * forwarded token), the CLI (a stored profile), and scripts (lazy password
 * login) differ *only* in which strategy they pass to `createHomesteadClient`.
 *
 * Every hook is optional except `token()`.
 */
export interface AuthStrategy {
  /**
   * Called once when the client is built, so strategies that make their own
   * requests can capture the transport.
   */
  attach?(transport: AuthTransport): void;

  /**
   * The bearer token to attach to requests, or `null`/`''` for anonymous.
   * May be async so a strategy can log in on first use.
   */
  token(): MaybePromise<string | null>;

  /**
   * The token-holder's user id, sent as `X-User-Id` on custom-method calls
   * (the gateway authenticates with both). Optional — CRUD works without it.
   */
  userId?(): MaybePromise<string | null>;

  /**
   * Persist a freshly-established session. Called by `auth.login` and
   * `auth.oauth.complete` so the strategy (localStorage, in-memory cache) can
   * store the new token + user.
   */
  setSession?(token: string, user: HomesteadUser | null): void;

  /** Drop the current session. Called by `auth.logout`. */
  clear?(): void;

  /**
   * Notified when a request came back 401, so a strategy can invalidate a
   * cached token and force a re-login on the next call.
   */
  onUnauthorized?(): MaybePromise<void>;
}
