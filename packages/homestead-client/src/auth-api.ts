import type { Http, Transport } from './http';
import type { AuthStrategy } from './auth/strategy';
import type { HomesteadUser, RawUser } from './types';
import { mapUser, rawLogin } from './user';
import { errorFromResponse } from './errors';

/** A login provider advertised by `GET /oauth/providers`. */
export interface OAuthProvider {
  name: string;
  display_name: string;
}

/** OAuth / OIDC helpers. */
export class OAuthApi {
  constructor(
    private readonly http: Http,
    private readonly transport: Transport,
    private readonly strategy: AuthStrategy,
  ) {}

  /**
   * List configured providers. Returns `[]` when OAuth is disabled or on any
   * error, so a UI can render zero buttons without special-casing.
   */
  async providers(): Promise<OAuthProvider[]> {
    try {
      const res = await this.http.request<{ providers?: OAuthProvider[] }>(
        '/oauth/providers',
      );
      return res.providers ?? [];
    } catch {
      return [];
    }
  }

  /**
   * The absolute URL that begins a provider login. The engine 302-redirects it
   * to the provider; the caller navigates the browser there
   * (`window.location.href = ...`) — the library never touches `window`.
   */
  startUrl(providerName: string): string {
    return this.http.url(`/oauth/${encodeURIComponent(providerName)}/start`);
  }

  /**
   * Finish an OAuth login. The provider callback handed back a bare token; we
   * resolve the user via `/users/me` using that token explicitly (not the
   * strategy's, which isn't set yet) and persist the session.
   */
  async complete(token: string): Promise<HomesteadUser> {
    const path = '/users/me';
    const res = await this.transport.fetch(`${this.transport.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = undefined;
    }
    if (!res.ok) throw errorFromResponse(res.status, path, text, parsed);
    const user = mapUser(parsed as RawUser);
    this.strategy.setSession?.(token, user);
    return user;
  }
}

/** Authentication surface: `client.auth`. */
export class AuthApi {
  readonly oauth: OAuthApi;

  constructor(
    private readonly http: Http,
    private readonly transport: Transport,
    private readonly strategy: AuthStrategy,
  ) {
    this.oauth = new OAuthApi(http, transport, strategy);
  }

  /**
   * Authenticate with email + password. On success the session is stored in the
   * auth strategy (localStorage for a browser session, in-memory otherwise).
   */
  async login(email: string, password: string): Promise<HomesteadUser> {
    const session = await rawLogin(this.transport, email, password);
    this.strategy.setSession?.(session.token, session.user);
    return session.user;
  }

  /**
   * Revoke the current token (best-effort) and clear the local session. The
   * local clear happens even if the network revoke fails.
   */
  async logout(): Promise<void> {
    try {
      const token = await this.strategy.token();
      if (token) {
        await this.transport.fetch(`${this.transport.baseUrl}/users/:logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // Server unreachable / token already gone — still clear locally.
    }
    this.strategy.clear?.();
  }

  /** Resolve the current token-holder via `GET /users/me`. */
  async me(): Promise<HomesteadUser> {
    const raw = await this.http.request<RawUser>('/users/me');
    return mapUser(raw);
  }

  /** The current bearer token, or `null`. */
  token(): ReturnType<AuthStrategy['token']> {
    return this.strategy.token();
  }
}
