/**
 * OAuth discovery metadata. Two documents:
 *  - Authorization Server Metadata (RFC 8414) at
 *    `/.well-known/oauth-authorization-server`.
 *  - a reusable Protected Resource Metadata builder (RFC 9728) that any
 *    resource server can mount at
 *    `/.well-known/oauth-protected-resource/<path>` to point clients at this AS.
 *
 * Everything is derived from the configured issuer URL (verbatim, never from
 * the request) so metadata stays correct behind a reverse proxy.
 */

import { Hono } from 'hono';
import type { AuthServerConfig } from '@rambleraptor/homestead-core/apps/config';
import { MCP_SCOPES_SUPPORTED } from '../../mcp/scopes';

const DEFAULT_SCOPES = MCP_SCOPES_SUPPORTED;

/** Permissive CORS — browser-based OAuth clients fetch these cross-origin. */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
} as const;

export function authorizationServerMetadata(cfg: AuthServerConfig): Record<string, unknown> {
  const issuer = cfg.issuerUrl.replace(/\/+$/, '');
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth2/authorize`,
    token_endpoint: `${issuer}/oauth2/token`,
    registration_endpoint: `${issuer}/oauth2/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: [
      'none',
      'client_secret_post',
      'client_secret_basic',
    ],
    scopes_supported: cfg.scopesSupported ?? DEFAULT_SCOPES,
  };
}

/**
 * RFC 9728 protected-resource metadata for a resource server living at
 * `resourceUrl`. Exported so any resource server (not just one) can serve its
 * own `/.well-known/oauth-protected-resource/<path>` pointing back at this AS.
 */
export function protectedResourceMetadata(
  cfg: AuthServerConfig,
  resourceUrl: string,
): Record<string, unknown> {
  const issuer = cfg.issuerUrl.replace(/\/+$/, '');
  return {
    resource: resourceUrl,
    authorization_servers: [issuer],
    scopes_supported: cfg.scopesSupported ?? DEFAULT_SCOPES,
    bearer_methods_supported: ['header'],
  };
}

/** The `.well-known` discovery routes for the authorization server. */
export function makeWellKnownRoutes(cfg: AuthServerConfig): Hono {
  const app = new Hono();
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });

  app.options('/*', () => new Response(null, { status: 204, headers: CORS_HEADERS }));
  app.get('/oauth-authorization-server', () => json(authorizationServerMetadata(cfg)));

  // Protected-resource metadata (RFC 9728) for the first-party MCP server. This
  // is the exact path the resource server's `WWW-Authenticate` challenge points
  // at, so a client can discover the AS from a 401. The root variant is a
  // fallback for clients that don't append the resource path.
  const mcpResource = `${cfg.issuerUrl.replace(/\/+$/, '')}/api/mcp`;
  const mcpPrm = () => json(protectedResourceMetadata(cfg, mcpResource));
  app.get('/oauth-protected-resource/api/mcp', mcpPrm);
  app.get('/oauth-protected-resource', mcpPrm);

  return app;
}
