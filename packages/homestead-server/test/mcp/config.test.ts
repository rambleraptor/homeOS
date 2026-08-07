/**
 * MCP configuration resolution + the `cloudflare-access` (Access-only) mode.
 *
 * The endpoint used to be mountable only alongside Homestead's OAuth
 * authorization server. These cover the decoupling: an explicit `mcp` block
 * drives the endpoint on its own, and in Access-only mode there is no bearer
 * path and no discovery pointer for a client to follow.
 */

import { describe, expect, it, test } from 'vitest';
import { Hono } from 'hono';
import type {
  AuthServerConfig,
  CloudflareAccessConfig,
  McpConfig,
} from '@rambleraptor/homestead-core/apps/config';
import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';
import { makeEngine } from '../engine/helpers';
import { AuthService } from '../../src/auth/service';
import { createOAuthTables } from '../../src/auth/oauth/storage';
import { resolveMcpConfig, mcpAudience } from '../../src/mcp/config';
import { makeMcpRoute } from '../../src/routes/mcp';
import type { AccessIdentity } from '../../src/auth/access-jwt';

const AS: AuthServerConfig = {
  enabled: true,
  issuerUrl: 'https://home.example.com',
};

const CF: CloudflareAccessConfig = { teamDomain: 'acme', aud: 'aud-tag' };

const BOOK: ResourceDefinition = {
  singular: 'book',
  plural: 'books',
  fields: { title: { type: 'string', required: true } },
};

describe('resolveMcpConfig', () => {
  it('derives the legacy shape from an enabled auth server', () => {
    expect(resolveMcpConfig(undefined, AS)).toEqual({
      mode: 'both',
      audience: 'https://home.example.com/api/mcp',
      issuerUrl: 'https://home.example.com',
      cloudflareAccess: undefined,
    });
  });

  it('does not mount without an auth server and without an mcp block', () => {
    expect(resolveMcpConfig(undefined, undefined)).toBeNull();
    expect(resolveMcpConfig(undefined, { ...AS, enabled: false })).toBeNull();
  });

  it('honours the legacy mcpEnabled opt-out', () => {
    expect(resolveMcpConfig(undefined, { ...AS, mcpEnabled: false })).toBeNull();
  });

  it('mounts Access-only with no auth server at all', () => {
    const mcp: McpConfig = { auth: 'cloudflare-access', cloudflareAccess: CF };
    expect(resolveMcpConfig(mcp, undefined)).toEqual({
      mode: 'cloudflare-access',
      cloudflareAccess: CF,
    });
  });

  it('Access-only carries no audience or issuer (no bearer path, no discovery)', () => {
    const resolved = resolveMcpConfig({ auth: 'cloudflare-access', cloudflareAccess: CF }, AS)!;
    expect(resolved.audience).toBeUndefined();
    expect(resolved.issuerUrl).toBeUndefined();
  });

  it('throws when Access-only is requested without an Access application', () => {
    expect(() => resolveMcpConfig({ auth: 'cloudflare-access' }, AS)).toThrow(/cloudflareAccess/);
  });

  it('throws when a bearer mode has no resource identifier', () => {
    expect(() => resolveMcpConfig({ auth: 'oauth' }, undefined)).toThrow(/resourceUrl/);
  });

  it('accepts an explicit resourceUrl without an auth server', () => {
    const resolved = resolveMcpConfig(
      { auth: 'oauth', resourceUrl: 'https://mcp.example.com/api/mcp' },
      undefined,
    )!;
    expect(resolved.audience).toBe('https://mcp.example.com/api/mcp');
  });

  it('an explicit enabled:false wins', () => {
    expect(resolveMcpConfig({ enabled: false }, AS)).toBeNull();
  });

  it('mcpAudience appends the path and trims trailing slashes', () => {
    expect(mcpAudience('https://h.example.com/')).toBe('https://h.example.com/api/mcp');
  });
});

describe('Access-only mode over HTTP', () => {
  const HEADER = 'Cf-Access-Jwt-Assertion';
  const initialize = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test', version: '1' },
    },
  });

  const stubVerifier = async (req: Request): Promise<AccessIdentity | null> => {
    const email = req.headers.get(HEADER);
    return email ? { email } : null;
  };

  async function harness() {
    const t = await makeEngine();
    createOAuthTables(t.engine.db);
    const auth = new AuthService(t.engine.db);
    const cfg = resolveMcpConfig({ auth: 'cloudflare-access', cloudflareAccess: CF }, AS)!;
    const app = new Hono();
    app.route('/api/mcp', makeMcpRoute(t.engine, cfg, () => [BOOK], { accessVerifier: stubVerifier }));
    return { t, auth, app };
  }

  test('a verified Access identity authenticates', async () => {
    const { t, app } = await harness();
    const res = await app.request('/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        [HEADER]: t.admin.email,
      },
      body: initialize,
    });
    expect(res.status).not.toBe(401);
    expect(await res.text()).toContain('serverInfo');
  });

  test('an otherwise-valid bearer token is rejected — there is no bearer path', async () => {
    const { t, auth, app } = await harness();
    // A token bound to the very audience the legacy mode would accept.
    const token = auth.issueSession(t.admin.id, {
      audience: mcpAudience(AS.issuerUrl),
    }).access_token;
    const res = await app.request('/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: initialize,
    });
    expect(res.status).toBe(401);
  });

  test('the 401 advertises no authorization server (Access owns the challenge)', async () => {
    const { app } = await harness();
    const res = await app.request('/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toBeNull();
  });

  test('a verified identity with no Homestead user is 403', async () => {
    const { app } = await harness();
    const res = await app.request('/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [HEADER]: 'stranger@example.com' },
      body: initialize,
    });
    expect(res.status).toBe(403);
  });
});
