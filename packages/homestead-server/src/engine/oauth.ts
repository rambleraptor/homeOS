/**
 * OAuth login — port of pkg/oauth + the old AEPBASE_OAUTH env wiring. Config
 * now arrives as a plain object (the `auth.oauth` block of
 * homestead.config.ts) instead of a serialized env var.
 *
 * Flow: GET /oauth/{name}/start sets a CSRF state cookie and redirects to the
 * provider; GET /oauth/{name}/callback verifies state, exchanges the code,
 * fetches userinfo, links/creates the local user (_oauth_identities), mints a
 * bearer token, and redirects to the success URL with `#token=...` in the
 * fragment (so it never lands in access logs).
 */

import type { Database } from './sqlite';
import { errorResponse, jsonResponse } from './errors';
import { generateId, generateToken, nowRFC3339 } from './ids';
import type { User } from './types';
import { TYPE_REGULAR } from './types';
import { getUserByEmail, getUserById, insertToken, insertUser } from './users';

/** One provider entry in homestead.config.ts `auth.oauth.providers`. */
export interface OAuthProviderConfig {
  name: string;
  displayName?: string;
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  allowRegistration?: boolean;
}

/** The `auth.oauth` block of homestead.config.ts. */
export interface OAuthConfig {
  redirectBaseUrl: string;
  successRedirect: string;
  providers: OAuthProviderConfig[];
}

/** A fully-resolved provider (redirect URLs composed, validated). */
export interface Provider {
  name: string;
  displayName: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  redirectUrl: string;
  successRedirectUrl: string;
  allowRegistration: boolean;
}

/** Invalid bcrypt hash: password login always fails for OAuth-only users. */
const NO_PASSWORD_SENTINEL = '!';

const STATE_COOKIE = 'aepbase_oauth_state';

/**
 * Cookie `Path` for the CSRF state cookie: the directory of the provider's
 * callback URL. Derived from `redirectUrl` (which carries the full mount
 * prefix, e.g. `/api/aep/oauth/google/callback`) so the cookie the `/start`
 * response sets is actually sent back on `/callback`. A hardcoded path breaks
 * whenever the engine is mounted under a prefix.
 */
function stateCookiePath(p: Provider): string {
  const { pathname } = new URL(p.redirectUrl);
  return pathname.slice(0, pathname.lastIndexOf('/') + 1);
}

/**
 * Build validated providers from config. Pure — unit-testable without a
 * server. Returns [] when config is absent or has no providers.
 */
export function buildProviders(cfg: OAuthConfig | null | undefined): Provider[] {
  if (!cfg || !cfg.providers || cfg.providers.length === 0) return [];
  if (!cfg.redirectBaseUrl) {
    throw new Error('redirectBaseUrl is required when providers are set');
  }
  if (!cfg.successRedirect) {
    throw new Error('successRedirect is required when providers are set');
  }
  const base = cfg.redirectBaseUrl.replace(/\/+$/, '');

  return cfg.providers.map((p) => {
    if (!p.name) throw new Error('oauth provider missing name');
    if (!p.clientId || !p.clientSecret) {
      throw new Error(`oauth provider "${p.name}": clientId and clientSecret are required`);
    }
    if (!p.authUrl || !p.tokenUrl || !p.userInfoUrl) {
      throw new Error(
        `oauth provider "${p.name}": authUrl, tokenUrl, and userInfoUrl are required`,
      );
    }
    return {
      name: p.name,
      displayName: p.displayName || p.name,
      clientId: p.clientId,
      clientSecret: p.clientSecret,
      scopes: p.scopes ?? [],
      authUrl: p.authUrl,
      tokenUrl: p.tokenUrl,
      userInfoUrl: p.userInfoUrl,
      redirectUrl: `${base}/oauth/${p.name}/callback`,
      successRedirectUrl: cfg.successRedirect,
      allowRegistration: p.allowRegistration ?? false,
    };
  });
}

export function createOAuthIdentitiesTable(db: Database): void {
  db.run(`CREATE TABLE IF NOT EXISTS _oauth_identities (
		provider TEXT NOT NULL,
		provider_user_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		email TEXT NOT NULL,
		create_time TEXT NOT NULL,
		PRIMARY KEY (provider, provider_user_id)
	)`);
}

function getIdentity(
  db: Database,
  provider: string,
  providerUserId: string,
): { user_id: string } | null {
  return db
    .query('SELECT user_id FROM _oauth_identities WHERE provider = ? AND provider_user_id = ?')
    .get(provider, providerUserId) as { user_id: string } | null;
}

function insertIdentity(
  db: Database,
  i: { provider: string; providerUserId: string; userId: string; email: string },
): void {
  db.query(
    'INSERT INTO _oauth_identities (provider, provider_user_id, user_id, email, create_time) VALUES (?, ?, ?, ?, ?)',
  ).run(i.provider, i.providerUserId, i.userId, i.email, nowRFC3339());
}

function parseCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  const header = req.headers.get('cookie');
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return out;
}

interface UserInfo {
  sub: string;
  email: string;
  name: string;
}

async function exchangeCode(p: Provider, code: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: p.redirectUrl,
    client_id: p.clientId,
    client_secret: p.clientSecret,
  });
  const resp = await fetch(p.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });
  const text = await resp.text();
  if (resp.status >= 400) {
    throw new Error(`token endpoint ${resp.status}: ${text}`);
  }
  let parsed: { access_token?: string };
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`decoding token response: ${err instanceof Error ? err.message : err}`);
  }
  if (!parsed.access_token) throw new Error('no access_token in response');
  return parsed.access_token;
}

async function fetchUserInfo(p: Provider, accessToken: string): Promise<UserInfo> {
  const resp = await fetch(p.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  const text = await resp.text();
  if (resp.status >= 400) {
    throw new Error(`userinfo endpoint ${resp.status}: ${text}`);
  }
  const raw = JSON.parse(text) as Record<string, unknown>;
  let sub = typeof raw.sub === 'string' ? raw.sub : '';
  // Some providers (e.g. GitHub) return "id" instead of "sub".
  if (!sub && raw.id !== undefined && raw.id !== null) sub = String(raw.id);
  return {
    sub,
    email: typeof raw.email === 'string' ? raw.email : '',
    name: typeof raw.name === 'string' ? raw.name : '',
  };
}

class RegistrationDisabledError extends Error {}

function findOrCreateUser(db: Database, p: Provider, info: UserInfo): User {
  const ident = getIdentity(db, p.name, info.sub);
  if (ident) {
    const found = getUserById(db, ident.user_id);
    if (!found) throw new Error(`identity references missing user "${ident.user_id}"`);
    return found.user;
  }

  const existing = getUserByEmail(db, info.email);
  if (existing) {
    insertIdentity(db, {
      provider: p.name,
      providerUserId: info.sub,
      userId: existing.user.id,
      email: info.email,
    });
    return existing.user;
  }

  if (!p.allowRegistration) throw new RegistrationDisabledError();

  const id = generateId();
  const now = nowRFC3339();
  const u: User = {
    id,
    path: `users/${id}`,
    email: info.email,
    display_name: info.name,
    type: TYPE_REGULAR,
    create_time: now,
    update_time: now,
  };
  insertUser(db, u, NO_PASSWORD_SENTINEL);
  insertIdentity(db, {
    provider: p.name,
    providerUserId: info.sub,
    userId: id,
    email: info.email,
  });
  return u;
}

export class OAuthRoutes {
  constructor(
    private db: Database,
    private providers: Map<string, Provider>,
  ) {}

  static fromConfig(db: Database, cfg: OAuthConfig | null | undefined): OAuthRoutes | null {
    const providers = buildProviders(cfg);
    if (providers.length === 0) return null;
    createOAuthIdentitiesTable(db);
    return new OAuthRoutes(db, new Map(providers.map((p) => [p.name, p])));
  }

  /** Dispatch /oauth/* paths; returns null for unmatched shapes. */
  async handle(req: Request, segments: string[]): Promise<Response | null> {
    if (req.method !== 'GET') return null;
    if (segments.length === 2 && segments[1] === 'providers') return this.listProviders();
    if (segments.length === 3) {
      const name = decodeURIComponent(segments[1]!);
      if (segments[2] === 'start') return this.start(req, name);
      if (segments[2] === 'callback') return this.callback(req, name);
    }
    return null;
  }

  private listProviders(): Response {
    const names = [...this.providers.keys()].sort();
    return jsonResponse({
      providers: names.map((n) => {
        const p = this.providers.get(n)!;
        return { name: p.name, display_name: p.displayName };
      }),
    });
  }

  private start(req: Request, name: string): Response {
    const provider = this.providers.get(name);
    if (!provider) return errorResponse(404, `unknown provider "${name}"`);

    const state = generateToken();
    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: provider.redirectUrl,
      response_type: 'code',
    });
    if (provider.scopes.length > 0) params.set('scope', provider.scopes.join(' '));
    params.set('state', state);

    const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${provider.authUrl}?${params.toString()}`,
        'Set-Cookie': `${STATE_COOKIE}=${state}; Path=${stateCookiePath(provider)}; Max-Age=600; HttpOnly; SameSite=Lax${secure}`,
      },
    });
  }

  private async callback(req: Request, name: string): Promise<Response> {
    const provider = this.providers.get(name);
    if (!provider) return errorResponse(404, `unknown provider "${name}"`);

    const url = new URL(req.url);
    const errParam = url.searchParams.get('error');
    if (errParam) {
      const desc = url.searchParams.get('error_description') ?? '';
      return errorResponse(400, `provider returned error: ${errParam}: ${desc}`);
    }

    const code = url.searchParams.get('code');
    if (!code) return errorResponse(400, 'missing code parameter');

    const cookieState = parseCookies(req)[STATE_COOKIE];
    if (!cookieState) {
      return errorResponse(
        400,
        'missing oauth state cookie; start the flow at /oauth/{provider}/start',
      );
    }
    const queryState = url.searchParams.get('state');
    if (!queryState || queryState !== cookieState) {
      return errorResponse(400, 'oauth state mismatch');
    }

    let accessToken: string;
    try {
      accessToken = await exchangeCode(provider, code);
    } catch (err) {
      return errorResponse(502, `code exchange failed: ${err instanceof Error ? err.message : err}`);
    }

    let info: UserInfo;
    try {
      info = await fetchUserInfo(provider, accessToken);
    } catch (err) {
      return errorResponse(502, `userinfo fetch failed: ${err instanceof Error ? err.message : err}`);
    }
    if (!info.sub || !info.email) {
      return errorResponse(502, 'provider userinfo missing required fields (sub, email)');
    }

    let user: User;
    try {
      user = findOrCreateUser(this.db, provider, info);
    } catch (err) {
      if (err instanceof RegistrationDisabledError) {
        return errorResponse(
          403,
          'registration is not enabled for this provider; the email is not linked to an existing account',
        );
      }
      return errorResponse(500, `user lookup failed: ${err instanceof Error ? err.message : err}`);
    }

    const token = generateToken();
    insertToken(this.db, token, user.id);

    const fragment = new URLSearchParams({ token: token });
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${provider.successRedirectUrl}#${fragment.toString()}`,
        // Clear the state cookie.
        'Set-Cookie': `${STATE_COOKIE}=; Path=${stateCookiePath(provider)}; Max-Age=0`,
      },
    });
  }
}
