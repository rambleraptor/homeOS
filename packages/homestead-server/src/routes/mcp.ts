/**
 * First-party MCP server at `/api/mcp` (Streamable HTTP).
 *
 * A thin OAuth 2.1 resource server: each request's bearer token is validated
 * against the auth service (audience-bound to this resource), then the AI
 * chat's tools are re-exposed over MCP, executed under the caller's token. The
 * server is stateless and rebuilt per request so tools bind to that caller —
 * exactly like `handleChat` rebuilds tools per request.
 *
 * Clients authorize with zero manual steps: an unauthenticated request returns
 * 401 with a `WWW-Authenticate` pointer to the protected-resource metadata,
 * from which the client discovers the authorization server, self-registers
 * (DCR) and runs the consent flow.
 */

import { Hono } from 'hono';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { AuthServerConfig } from '@rambleraptor/homestead-core/apps/config';
import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';
import type { Engine } from '../engine/engine';
import { verifyAccessToken, unauthorizedResponse } from '../auth/oauth/verify';
import { registerHomesteadTools } from '../mcp/register';

/** The resource identifier MCP tokens are audience-bound to. */
export function mcpAudience(issuerUrl: string): string {
  return `${issuerUrl.replace(/\/+$/, '')}/api/mcp`;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version',
} as const;

/**
 * Build the `/api/mcp` route. `resolveDefs` yields the resource definitions to
 * expose as tools (the server passes the same union the chat handler uses); it
 * is injected rather than imported so the route stays decoupled from the app
 * registry and unit-testable.
 */
export function makeMcpRoute(
  engine: Engine,
  cfg: AuthServerConfig,
  resolveDefs: () => ResourceDefinition[],
): Hono {
  const audience = mcpAudience(cfg.issuerUrl);
  const app = new Hono();

  app.options('/', () => new Response(null, { status: 204, headers: CORS_HEADERS }));

  app.all('/', async (c) => {
    const verified = verifyAccessToken(engine.db, c.req.raw, { audience });
    if (!verified) return unauthorizedResponse(cfg.issuerUrl, '/api/mcp');

    const defs = resolveDefs();

    // Stateless: no session id, one JSON response per request, fresh server +
    // transport each time (tools bind to this caller's token).
    const server = new McpServer({ name: 'homestead', version: '0.2.0' });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    registerHomesteadTools(server, defs, verified.token);
    await server.connect(transport);
    try {
      const res = await transport.handleRequest(c.req.raw);
      for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
      return res;
    } finally {
      await transport.close();
    }
  });

  return app;
}
