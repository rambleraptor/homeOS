/**
 * First-party MCP server at `/api/mcp` (Streamable HTTP).
 *
 * The AI chat's tools are re-exposed over MCP and executed under the calling
 * user's own token. The server is stateless and rebuilt per request so tools
 * bind to that caller — exactly like `handleChat` rebuilds tools per request.
 *
 * How a caller authenticates depends on the resolved {@link ResolvedMcpConfig}
 * mode:
 *  - `oauth`/`both` — a bearer token audience-bound to this resource. An
 *    unauthenticated request returns 401 with a `WWW-Authenticate` pointer to
 *    the protected-resource metadata, from which the client discovers the
 *    authorization server, self-registers (DCR) and runs the consent flow.
 *  - `cloudflare-access` — **only** a verified `Cf-Access-Jwt-Assertion`
 *    forwarded by Cloudflare Access. There is no bearer path and no discovery
 *    pointer: Access owns the challenge, so the instance publishes no OAuth
 *    surface at all.
 */

import { Hono } from 'hono';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';
import type { Engine } from '../engine/engine';
import { verifyAccessToken, unauthorizedResponse } from '../auth/oauth/verify';
import { makeAccessJwtVerifier, accessJwtLog, type AccessIdentity } from '../auth/access-jwt';
import { getUserByEmail } from '../engine/users';
import { mintTokenForUser } from '../bootstrap';
import { registerHomesteadTools } from '../mcp/register';
import { scopeAllowsWrite } from '../mcp/scopes';
import type { ResolvedMcpConfig } from '../mcp/config';

export { mcpAudience } from '../mcp/config';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version',
} as const;

/** How a request to `/api/mcp` was authenticated, resolved to a caller token. */
interface ResolvedCaller {
  /** A bearer token the engine accepts for this caller. */
  token: string;
  /** The OAuth scope string, or null (Access-authenticated callers are unscoped). */
  scope: string | null;
  /** Release a token minted for this request; a no-op for a caller's own token. */
  release: () => void;
}

/** Options for {@link makeMcpRoute}; the verifier override is a test seam. */
export interface McpRouteOptions {
  /**
   * Override the Cloudflare Access JWT verifier. Defaults to one built from
   * `cfg.cloudflareAccess` (absent → the Access fallback is disabled). Injected
   * in tests so the route can be exercised without a live JWKS endpoint.
   */
  accessVerifier?: (req: Request) => Promise<AccessIdentity | null>;
}

function forbidden(message: string): Response {
  return new Response(JSON.stringify({ error: 'forbidden', message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/**
 * Build the `/api/mcp` route. `resolveDefs` yields the resource definitions to
 * expose as tools (the server passes the same union the chat handler uses); it
 * is injected rather than imported so the route stays decoupled from the app
 * registry and unit-testable.
 */
export function makeMcpRoute(
  engine: Engine,
  cfg: ResolvedMcpConfig,
  resolveDefs: () => ResourceDefinition[],
  opts: McpRouteOptions = {},
): Hono {
  const bearerAllowed = cfg.mode !== 'cloudflare-access';
  const accessAllowed = cfg.mode !== 'oauth';
  const accessVerifier =
    opts.accessVerifier ??
    (accessAllowed && cfg.cloudflareAccess ? makeAccessJwtVerifier(cfg.cloudflareAccess) : null);
  const app = new Hono();

  app.options('/', () => new Response(null, { status: 204, headers: CORS_HEADERS }));

  /**
   * A plain 401. In `cloudflare-access` mode the endpoint advertises no
   * authorization server of its own — Access issues the challenge — so no
   * `WWW-Authenticate` discovery pointer is emitted.
   */
  function unauthorized(): Response {
    if (cfg.issuerUrl) return unauthorizedResponse(cfg.issuerUrl, '/api/mcp');
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  /**
   * Resolve a request to a caller token. Depending on the mode, tries the
   * endpoint's own OAuth (an audience-bound bearer) and/or a verified
   * `Cf-Access-Jwt-Assertion` — mapping the latter's email to a Homestead user
   * and minting a short-lived token to act as them. Returns a Response to
   * short-circuit (401/403) when nothing authenticates.
   */
  async function resolveCaller(req: Request): Promise<ResolvedCaller | Response> {
    if (bearerAllowed && cfg.audience) {
      const verified = verifyAccessToken(engine.db, req, { audience: cfg.audience });
      if (verified) {
        return { token: verified.token, scope: verified.scope, release: () => {} };
      }
    }
    if (accessVerifier) {
      const identity = await accessVerifier(req);
      if (identity) {
        const found = getUserByEmail(engine.db, identity.email);
        if (!found) {
          accessJwtLog.debug('no Homestead user for verified email', { email: identity.email });
          return forbidden(`no Homestead user for ${identity.email}`);
        }
        // Access-authenticated callers are unscoped → full read+write, matching
        // the endpoint's treatment of an unscoped OAuth token.
        const minted = mintTokenForUser(engine.db, found.user.id);
        return { token: minted.token, scope: null, release: minted.revoke };
      }
    } else if (accessAllowed) {
      accessJwtLog.debug('Cloudflare Access not configured (mcp.cloudflareAccess absent)');
    }
    return unauthorized();
  }

  app.all('/', async (c) => {
    const caller = await resolveCaller(c.req.raw);
    if (caller instanceof Response) return caller;

    const defs = resolveDefs();

    // Stateless: no session id, one JSON response per request, fresh server +
    // transport each time (tools bind to this caller's token).
    const server = new McpServer({ name: 'homestead', version: '0.2.0' });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    registerHomesteadTools(server, defs, caller.token, {
      write: scopeAllowsWrite(caller.scope),
    });
    await server.connect(transport);
    try {
      const res = await transport.handleRequest(c.req.raw);
      for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
      return res;
    } finally {
      await transport.close();
      // Release any token minted for an Access-authenticated caller. The lease
      // defers the real delete until in-flight operations settle.
      caller.release();
    }
  });

  return app;
}
