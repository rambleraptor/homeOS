/**
 * The engine: a fetch-style handler serving the full aepbase API surface at
 * bare paths (/users, /aep-resource-definitions, /openapi.json, dynamic
 * resources). Request flow mirrors the Go server: CORS/OPTIONS short-circuit
 * → bearer auth (with the same exemptions) → app-access check → route.
 */

import type { Database } from './sqlite';
import { join } from 'node:path';
import { openDb } from './db';
import { errorResponse, HttpError } from './errors';
import {
  handleMetaCreate,
  handleMetaDelete,
  handleMetaGet,
  handleMetaList,
  handleMetaUpdate,
  loadAllDefinitions,
  topoSortDefs,
} from './meta';
import { OAuthRoutes, type OAuthConfig, type SessionIssuer } from './oauth';
import { buildOpenApi } from './openapi';
import { Registry } from './registry';
import { notFoundText, routeDynamic } from './router';
import type { User } from './types';
import {
  createUserTables,
  extractBearerToken,
  getUserByToken,
  handleLogin,
  handleLogout,
  handleUserCreate,
  handleUserDelete,
  handleUserGet,
  handleUserList,
  handleUserUpdate,
} from './users';

/**
 * Hook for app-access gating (Phase 3): return a Response to short-circuit
 * the request, or null to continue.
 */
export type AccessCheck = (
  req: Request,
  segments: string[],
  caller: User | null,
) => Response | null;

/**
 * Resolves a bearer token to the calling user (or null if invalid/expired).
 * Injected the same way as {@link AccessCheck} so the auth service can own the
 * token lifecycle (expiry, revocation) without the engine knowing the rules.
 * When none is set the engine falls back to a plain {@link getUserByToken}.
 */
export type TokenValidator = (token: string) => Promise<User | null> | User | null;

export interface EngineOptions {
  /** Path to the sqlite file (or ":memory:"). */
  dbPath: string;
  /** On-disk root for file-field contents (data/files). */
  filesDir: string;
  /** Base URL echoed in file-field download URLs. */
  serverUrl: string;
  corsAllowedOrigins?: string[];
  accessCheck?: AccessCheck;
  /** Overrides the default bearer-token lookup (see {@link TokenValidator}). */
  tokenValidator?: TokenValidator;
  /** Mints federated-login sessions (see {@link SessionIssuer}). */
  sessionIssuer?: SessionIssuer;
  /** The `auth.oauth` block of homestead.config.ts (optional). */
  oauth?: OAuthConfig | null;
}

export class Engine {
  readonly db: Database;
  readonly registry: Registry;
  private corsAllowedOrigins: string[];
  private accessCheck: AccessCheck | null;
  private tokenValidator: TokenValidator | null;
  private sessionIssuer: SessionIssuer | null;
  private oauth: OAuthRoutes | null;

  constructor(opts: EngineOptions) {
    this.db = openDb(opts.dbPath);
    createUserTables(this.db);
    this.registry = new Registry(this.db, {
      filesDir: opts.filesDir,
      serverUrl: opts.serverUrl,
    });
    this.corsAllowedOrigins = opts.corsAllowedOrigins ?? [];
    this.accessCheck = opts.accessCheck ?? null;
    this.tokenValidator = opts.tokenValidator ?? null;
    this.sessionIssuer = opts.sessionIssuer ?? null;
    this.oauth = OAuthRoutes.fromConfig(this.db, opts.oauth);

    // Restore resource definitions from a previous run, parents first.
    for (const def of topoSortDefs(loadAllDefinitions(this.db))) {
      this.registry.addResource(def);
    }
  }

  setAccessCheck(check: AccessCheck | null): void {
    this.accessCheck = check;
  }

  setTokenValidator(validator: TokenValidator | null): void {
    this.tokenValidator = validator;
  }

  setSessionIssuer(issuer: SessionIssuer | null): void {
    this.sessionIssuer = issuer;
  }

  /** Make an engine-relative options object for a data dir (convenience). */
  static optionsForDataDir(
    dataDir: string,
    serverUrl: string,
    extra?: Partial<EngineOptions>,
  ): EngineOptions {
    return {
      dbPath: join(dataDir, 'aepbase.db'),
      filesDir: join(dataDir, 'files'),
      serverUrl,
      ...extra,
    };
  }

  /** CORS headers for the request origin, when allowed. */
  private corsHeaders(req: Request): Record<string, string> {
    const origin = req.headers.get('origin');
    if (!origin || this.corsAllowedOrigins.length === 0) return {};
    for (const allowed of this.corsAllowedOrigins) {
      if (allowed === '*' || allowed === origin) {
        return {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };
      }
    }
    return {};
  }

  /** Auth exemptions, identical to the Go middleware. */
  private isAuthExempt(method: string, path: string): boolean {
    if (method === 'POST' && path === '/users/:login') return true;
    if (path.startsWith('/oauth/')) return true;
    if (method === 'GET' && path === '/openapi.json') return true;
    if (method === 'OPTIONS') return true;
    return false;
  }

  fetch = async (req: Request): Promise<Response> => {
    const cors = this.corsHeaders(req);
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    let res: Response;
    try {
      res = await this.handle(req);
    } catch (err) {
      if (err instanceof HttpError) {
        res = errorResponse(err.status, err.message);
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        res = errorResponse(500, msg);
      }
    }

    if (Object.keys(cors).length > 0) {
      res = new Response(res.body, res);
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    }
    if (process.env.HOMESTEAD_DEBUG_HTTP && res.status >= 400) {
      console.log(`[engine] ${req.method} ${new URL(req.url).pathname} → ${res.status}`);
    }
    return res;
  };

  private async handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // Authenticate (everything requires a bearer token except the exemptions).
    let caller: User | null = null;
    if (!this.isAuthExempt(req.method, path)) {
      const token = extractBearerToken(req);
      if (token === '') {
        return errorResponse(401, 'missing or invalid Authorization header');
      }
      caller = this.tokenValidator
        ? await this.tokenValidator(token)
        : getUserByToken(this.db, token);
      if (!caller) return errorResponse(401, 'invalid token');
    }

    const segments = path.split('/').filter((s) => s.length > 0);

    if (this.accessCheck) {
      const denied = this.accessCheck(req, segments, caller);
      if (denied) return denied;
    }

    if (req.method === 'GET' && path === '/openapi.json') {
      return new Response(JSON.stringify(buildOpenApi(this.registry), null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (segments[0] === 'aep-resource-definitions') {
      return this.routeMeta(req, segments);
    }

    if (segments[0] === 'users' && segments.length <= 2) {
      return this.routeUsers(req, segments, caller);
    }

    if (segments[0] === 'oauth') {
      if (!this.oauth) return notFoundText();
      const res = await this.oauth.handle(req, segments, this.sessionIssuer);
      return res ?? notFoundText();
    }

    const dynamicRes = await routeDynamic(this.registry, req, segments, caller);
    if (dynamicRes) return dynamicRes;

    return notFoundText();
  }

  private async routeMeta(req: Request, segments: string[]): Promise<Response> {
    if (segments.length === 1) {
      if (req.method === 'POST') return handleMetaCreate(this.registry, req);
      if (req.method === 'GET') return handleMetaList(this.registry, req);
      return notFoundText();
    }
    if (segments.length === 2) {
      const id = decodeURIComponent(segments[1]!);
      if (req.method === 'GET') return handleMetaGet(this.registry, id);
      if (req.method === 'PATCH') return handleMetaUpdate(this.registry, req, id);
      if (req.method === 'DELETE') return handleMetaDelete(this.registry, id);
    }
    return notFoundText();
  }

  private async routeUsers(
    req: Request,
    segments: string[],
    caller: User | null,
  ): Promise<Response> {
    if (segments.length === 1) {
      if (req.method === 'POST') return handleUserCreate(this.db, req, caller);
      if (req.method === 'GET') return handleUserList(this.db, req, caller);
      return notFoundText();
    }

    const raw = decodeURIComponent(segments[1]!);
    const colon = raw.indexOf(':');
    if (colon >= 0) {
      const verb = raw.slice(colon + 1);
      if (req.method === 'POST') {
        if (verb === 'login') return handleLogin(this.db, req);
        if (verb === 'logout') return handleLogout(this.db, req);
        return errorResponse(404, `unknown method "${verb}"`);
      }
      return errorResponse(404, `unknown GET method "${verb}"`);
    }

    switch (req.method) {
      case 'GET':
        return handleUserGet(this.db, raw, caller);
      case 'PATCH':
        return handleUserUpdate(this.db, req, raw, caller);
      case 'DELETE':
        return handleUserDelete(this.db, raw, caller);
      case 'POST':
        return errorResponse(405, 'POST not allowed on individual user resource');
      default:
        return notFoundText();
    }
  }
}
