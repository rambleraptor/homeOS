/**
 * MCP server tests.
 *  - HTTP surface: unauthenticated 401 + WWW-Authenticate, and the
 *    protected-resource metadata a client discovers from it.
 *  - Protocol: the tools registered on an McpServer, driven through a real MCP
 *    Client over an in-memory transport (tools/list + the error path of
 *    tools/call). Real CRUD persistence runs against a live engine and is
 *    covered by the boot smoke test, since executeToolCall talks to aepbase
 *    over AEPBASE_URL.
 */

import { describe, expect, it, test } from 'vitest';
import { Hono } from 'hono';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthServerConfig } from '@rambleraptor/homestead-core/apps/config';
import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';
import { makeEngine } from '../engine/helpers';
import { AuthService } from '../../src/auth/service';
import { createOAuthTables } from '../../src/auth/oauth/storage';
import { makeWellKnownRoutes } from '../../src/auth/oauth/metadata';
import { makeMcpRoute, mcpAudience } from '../../src/routes/mcp';
import { registerHomesteadTools, type RegisterOptions } from '../../src/mcp/register';
import { scopeAllowsWrite } from '../../src/mcp/scopes';

const CFG: AuthServerConfig = {
  enabled: true,
  issuerUrl: 'https://home.example.com',
  scopesSupported: ['homestead'],
};

const BOOK: ResourceDefinition = {
  singular: 'book',
  plural: 'books',
  fields: {
    title: { type: 'string', required: true },
    pages: { type: 'number' },
  },
};

async function httpHarness() {
  const t = await makeEngine();
  createOAuthTables(t.engine.db);
  const auth = new AuthService(t.engine.db);
  const app = new Hono();
  app.route('/.well-known', makeWellKnownRoutes(CFG));
  app.route('/api/mcp', makeMcpRoute(t.engine, CFG, () => [BOOK]));
  return { t, auth, app };
}

describe('MCP HTTP surface', () => {
  test('an unauthenticated request is 401 with a discovery pointer', async () => {
    const { app } = await httpHarness();
    const res = await app.request('/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toContain(
      'https://home.example.com/.well-known/oauth-protected-resource/api/mcp',
    );
  });

  test('protected-resource metadata points at the resource and the AS', async () => {
    const { app } = await httpHarness();
    const res = await app.request('/.well-known/oauth-protected-resource/api/mcp');
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.resource).toBe('https://home.example.com/api/mcp');
    expect(body.authorization_servers).toEqual(['https://home.example.com']);
  });

  test('an audience-bound token passes auth and the transport answers initialize', async () => {
    const { t, auth, app } = await httpHarness();
    const token = auth.issueSession(t.admin.id, { audience: mcpAudience(CFG.issuerUrl) })
      .access_token;
    const res = await app.request('/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test', version: '1' },
        },
      }),
    });
    expect(res.status).not.toBe(401);
    const text = await res.text();
    // Streamable HTTP with enableJsonResponse returns the JSON-RPC result
    // (possibly as an SSE `data:` line); either way it carries serverInfo.
    expect(text).toContain('serverInfo');
    // A wrong-audience token is rejected even though the token is otherwise valid.
    const wrong = auth.issueSession(t.admin.id, { audience: 'https://other/resource' })
      .access_token;
    const badRes = await app.request('/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${wrong}` },
      body: '{}',
    });
    expect(badRes.status).toBe(401);
  });
});

describe('scopeAllowsWrite', () => {
  it('grants write for the write scope, the legacy scope, and unscoped tokens', () => {
    expect(scopeAllowsWrite('homestead:write')).toBe(true);
    expect(scopeAllowsWrite('homestead:read homestead:write')).toBe(true);
    expect(scopeAllowsWrite('homestead')).toBe(true);
    expect(scopeAllowsWrite(null)).toBe(true);
    expect(scopeAllowsWrite('')).toBe(true);
  });

  it('limits a read-only scope to reads', () => {
    expect(scopeAllowsWrite('homestead:read')).toBe(false);
  });
});

describe('MCP tool registration (over an in-memory client)', () => {
  async function connectClient(defs: ResourceDefinition[], opts?: RegisterOptions) {
    const server = new McpServer({ name: 'homestead', version: '0.2.0' });
    registerHomesteadTools(server, defs, 'test-token', opts);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(clientTransport);
    return client;
  }

  it('exposes the four CRUD tools for a resource and no search tool by default', async () => {
    const client = await connectClient([BOOK]);
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining(['create_book', 'read_book', 'update_book', 'delete_book']),
    );
    // Embeddings/vector store aren't configured in this process → no search tool.
    expect(names).not.toContain('search_documents');
    await client.close();
  });

  it('a read-only registration exposes only the read tool, no writers', async () => {
    const client = await connectClient([BOOK], { write: false });
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    expect(names).toContain('read_book');
    expect(names).not.toContain('create_book');
    expect(names).not.toContain('update_book');
    expect(names).not.toContain('delete_book');
    await client.close();
  });

  it('a CRUD tool is callable and surfaces failures as a structured error', async () => {
    // No engine is reachable at AEPBASE_URL here, so executeToolCall returns a
    // structured error rather than throwing — proving the tool is wired and the
    // error mapping works. (Successful persistence is covered by the boot smoke.)
    const client = await connectClient([BOOK]);
    const res = (await client.callTool({ name: 'read_book', arguments: {} })) as {
      isError?: boolean;
      content: { type: string; text: string }[];
    };
    expect(res.isError).toBe(true);
    expect(res.content[0].type).toBe('text');
    await client.close();
  });
});
