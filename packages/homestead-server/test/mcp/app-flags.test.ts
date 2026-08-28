/**
 * The `settings.mcp_tools` flag: reading it off the engine's own db, and the
 * MCP route honouring it per request (no restart between surfaces).
 */

import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import type { AuthServerConfig } from '@rambleraptor/homestead-core/apps/config';
import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';
import { readAppFlag } from '../../src/app-flags';
import { makeMcpRoute, mcpAudience } from '../../src/routes/mcp';
import { AuthService } from '../../src/auth/service';
import { createOAuthTables } from '../../src/auth/oauth/storage';
import { call, defineResource, makeEngine, type TestEngine } from '../engine/helpers';

const CFG: AuthServerConfig = {
  enabled: true,
  issuerUrl: 'https://home.example.com',
  scopesSupported: ['homestead'],
};

const BOOK: ResourceDefinition = {
  singular: 'book',
  plural: 'books',
  fields: { title: { type: 'string', required: true } },
};

/** The `app-flags` singleton as the schema sync builds it, flag column and all. */
async function defineAppFlags(t: TestEngine): Promise<void> {
  await defineResource(t, {
    singular: 'app-flag',
    plural: 'app-flags',
    user_settable_create: true,
    schema: {
      type: 'object',
      properties: { settings__mcp_tools: { type: 'string' } },
    },
  });
}

async function setFlag(t: TestEngine, value: string): Promise<void> {
  await call(t.engine, 'POST', '/app-flags', {
    token: t.adminToken,
    body: { settings__mcp_tools: value },
  });
}

/** Fetch the full tool specs over the route, as a client would. */
async function listToolSpecs(
  app: Hono,
  token: string,
): Promise<Array<{ name: string; inputSchema: Record<string, unknown> }>> {
  const send = async (body: unknown) =>
    app.request('/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  await send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test', version: '1' },
    },
  });
  const res = await send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const text = await res.text();
  // enableJsonResponse answers with JSON, possibly wrapped in an SSE `data:` line.
  const payload = JSON.parse(text.startsWith('data:') ? text.slice(5).trim() : text);
  return payload.result?.tools ?? [];
}

/** Just the tool names, which is all most of these assertions need. */
async function listTools(app: Hono, token: string): Promise<string[]> {
  return (await listToolSpecs(app, token)).map((tool) => tool.name);
}

async function harness() {
  const t = await makeEngine();
  createOAuthTables(t.engine.db);
  const auth = new AuthService(t.engine.db);
  const app = new Hono();
  app.route('/api/mcp', makeMcpRoute(t.engine, CFG, () => [BOOK]));
  const token = auth.issueSession(t.admin.id, { audience: mcpAudience(CFG.issuerUrl) })
    .access_token;
  return { t, app, token };
}

describe('readAppFlag', () => {
  it('reads a set flag, and reports unset for everything else', async () => {
    const t = await makeEngine();
    // No app-flags collection at all yet — an unset flag, not a crash.
    expect(readAppFlag(t.engine, 'settings', 'mcp_tools')).toBeUndefined();

    await defineAppFlags(t);
    // Collection exists but holds no row.
    expect(readAppFlag(t.engine, 'settings', 'mcp_tools')).toBeUndefined();

    await setFlag(t, 'generic');
    expect(readAppFlag(t.engine, 'settings', 'mcp_tools')).toBe('generic');
    // A flag no app declares is unset, not an error.
    expect(readAppFlag(t.engine, 'settings', 'nope')).toBeUndefined();
  });

  it('treats a blank value as unset', async () => {
    const t = await makeEngine();
    await defineAppFlags(t);
    await setFlag(t, '');
    expect(readAppFlag(t.engine, 'settings', 'mcp_tools')).toBeUndefined();
  });
});

describe('the MCP route honours settings.mcp_tools', () => {
  it('serves the per-resource surface when the flag is unset', async () => {
    const { app, token } = await harness();
    const names = await listTools(app, token);
    // One tool, named for the resource; the verb is its `action` parameter.
    expect(names).toEqual(['books']);
    expect(names).not.toContain('read_book');
    expect(names).not.toContain('read_records');
  });

  it('serves that tool with its schema intact — enum, types, and all', async () => {
    // The surface's whole value is that the field schemas reach the client, so
    // assert the JSON Schema a real client receives rather than the Zod object
    // we handed the SDK.
    const { app, token } = await harness();
    const [books] = await listToolSpecs(app, token);
    expect(books.name).toBe('books');

    const properties = books.inputSchema.properties as Record<string, Record<string, unknown>>;
    expect(properties.action.enum).toEqual(['list', 'get', 'create', 'update', 'delete']);
    expect(books.inputSchema.required).toEqual(['action']);
    expect(properties.id.type).toBe('string');
    expect(properties.fields.properties).toEqual({ title: { type: 'string' } });
  });

  it('switches to the typed surface when the flag is flipped, with no restart', async () => {
    const { t, app, token } = await harness();
    await defineAppFlags(t);
    expect(await listTools(app, token)).toEqual(['books']);

    // Same route object, same process — only the flag changed.
    await setFlag(t, 'typed');
    const names = await listTools(app, token);
    expect(names).toEqual(
      expect.arrayContaining(['create_book', 'read_book', 'update_book', 'delete_book']),
    );
    expect(names).not.toContain('books');
  });

  it('switches to the generic surface when the flag is flipped, with no restart', async () => {
    const { t, app, token } = await harness();
    await defineAppFlags(t);

    await setFlag(t, 'generic');
    const names = await listTools(app, token);
    // No resource here declares a custom method, so run_custom_method is absent.
    expect(names.sort()).toEqual([
      'create_record',
      'delete_record',
      'describe_resources',
      'read_records',
      'update_record',
    ]);
    expect(names).not.toContain('books');
  });
});
