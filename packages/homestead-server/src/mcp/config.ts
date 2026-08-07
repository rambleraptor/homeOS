/**
 * Resolves the effective MCP endpoint configuration.
 *
 * The endpoint used to exist only inside the OAuth authorization server's
 * mounting block, so enabling MCP forced an instance to also publish discovery
 * documents, a consent page, and dynamic client registration. That coupling is
 * gone: an explicit `mcp` block in `homestead.config.ts` drives the endpoint on
 * its own, and `auth: 'cloudflare-access'` runs it with Cloudflare Access as the
 * sole identity layer — no OAuth server, no public OAuth surface.
 *
 * When no `mcp` block is present the legacy shape is derived from
 * `auth.authServer` so existing configs keep working unchanged.
 */

import type {
  AuthServerConfig,
  CloudflareAccessConfig,
  McpAuthMode,
  McpConfig,
} from '@rambleraptor/homestead-core/apps/config';

/** The effective, fully-resolved MCP configuration used by the route. */
export interface ResolvedMcpConfig {
  /** How callers authenticate. */
  mode: McpAuthMode;
  /**
   * The resource identifier bearer tokens must be audience-bound to. Absent in
   * `cloudflare-access` mode, where no bearer token is ever accepted.
   */
  audience?: string;
  /**
   * Issuer origin used to build the `WWW-Authenticate` discovery pointer on a
   * `401`. Absent in `cloudflare-access` mode — Access owns the challenge, so
   * the endpoint advertises no OAuth server of its own.
   */
  issuerUrl?: string;
  /** The Access application in front of the endpoint, when configured. */
  cloudflareAccess?: CloudflareAccessConfig;
}

/** The resource identifier MCP tokens are audience-bound to. */
export function mcpAudience(issuerUrl: string): string {
  return `${issuerUrl.replace(/\/+$/, '')}/api/mcp`;
}

/**
 * Resolve the MCP configuration, or null when the endpoint should not mount.
 *
 * An explicit `mcp` block wins. Otherwise MCP is derived from `authServer`
 * exactly as before: on whenever the AS is enabled and `mcpEnabled` isn't
 * false, in `both` mode, inheriting the AS's `cloudflareAccess`.
 */
export function resolveMcpConfig(
  mcp: McpConfig | undefined,
  authServer: AuthServerConfig | undefined,
): ResolvedMcpConfig | null {
  const asEnabled = authServer?.enabled === true;

  if (!mcp) {
    if (!asEnabled || authServer?.mcpEnabled === false) return null;
    return {
      mode: 'both',
      audience: mcpAudience(authServer!.issuerUrl),
      issuerUrl: authServer!.issuerUrl,
      cloudflareAccess: authServer!.cloudflareAccess,
    };
  }

  if (mcp.enabled === false) return null;

  const mode: McpAuthMode = mcp.auth ?? 'both';
  const cloudflareAccess = mcp.cloudflareAccess ?? authServer?.cloudflareAccess;

  if (mode === 'cloudflare-access') {
    if (!cloudflareAccess) {
      throw new Error(
        'mcp.auth is "cloudflare-access" but no mcp.cloudflareAccess (team domain + aud) is configured',
      );
    }
    // No bearer path at all: no audience to bind, no issuer to advertise.
    return { mode, cloudflareAccess };
  }

  // The bearer path needs a resource identifier. Prefer an explicit
  // resourceUrl, else derive it from the authorization server's issuer.
  const resourceUrl = mcp.resourceUrl ?? (asEnabled ? mcpAudience(authServer!.issuerUrl) : undefined);
  if (!resourceUrl) {
    throw new Error(
      `mcp.auth is "${mode}" but neither mcp.resourceUrl nor an enabled auth.authServer is configured`,
    );
  }
  return {
    mode,
    audience: resourceUrl,
    issuerUrl: authServer?.issuerUrl,
    cloudflareAccess,
  };
}
