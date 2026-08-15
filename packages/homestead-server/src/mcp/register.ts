/**
 * Registers Homestead's tools on an MCP server. This is the MCP analog of the
 * tool-wiring loop in `core/server/chat/handler.ts`: it reuses the exact same
 * `buildTools` / `executeToolCall` / `makeSearchTool` machinery the AI chat
 * uses, so the CRUD surface and the chat surface stay identical by construction.
 * On top of those it registers one tool per app-declared AEP-136 custom method
 * (see `./custom-methods`), which the chat has no equivalent of — an MCP client
 * would otherwise be limited to plain CRUD.
 *
 * Tools bind to a single caller's token, so this runs once per request (the
 * route builds a fresh McpServer each time), mirroring how `handleChat`
 * rebuilds tools per request.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';
import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';
import { buildTools } from '@rambleraptor/homestead-core/server/chat/tools';
import { executeToolCall } from '@rambleraptor/homestead-core/server/chat/execute';
import {
  makeSearchTool,
  SEARCH_TOOL_NAME,
} from '@rambleraptor/homestead-core/server/chat/search-tool';
import { buildCustomMethodTools, executeCustomMethod } from './custom-methods';
import { buildGenericTools, type McpToolMode } from './generic';

function ok(result: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(result ?? null) }] };
}

function err(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

/** Options controlling which tools are exposed. */
export interface RegisterOptions {
  /**
   * Expose the write tools (create/update/delete). When false, only the
   * read tools and document search are registered. Defaults to true.
   */
  write?: boolean;
  /**
   * Which surface to register:
   *  - `typed` (default) — per-resource CRUD tools plus one per custom method.
   *    Richer provider-side schemas, but ~167 tools on a stock instance.
   *  - `generic` — six resource-parameterized tools (see `./generic`), so the
   *    tool count stays flat as apps are added. Opt in with
   *    `auth.authServer.mcpTools: 'generic'`.
   */
  mode?: McpToolMode;
}

/**
 * Register the CRUD tools (one set per resource), one tool per declared AEP-136
 * custom method, plus the semantic `search_documents` tool (only when
 * embeddings are configured) on `server` — all executing against aepbase under
 * `token`, so every action runs with exactly the calling user's permissions.
 *
 * When `opts.write` is false, the create/update/delete tools are omitted and
 * only the read-only surface (the `read_*` tools, `GET` custom methods, and
 * document search) is exposed, so a read-only authorization can't mutate data.
 */
export function registerHomesteadTools(
  server: McpServer,
  defs: ResourceDefinition[],
  token: string,
  opts: RegisterOptions = {},
): void {
  const write = opts.write ?? true;
  if (opts.mode === 'generic') {
    registerGenericTools(server, defs, token, write);
    registerSearchTool(server, defs, token);
    return;
  }

  const { tools, bindings } = buildTools(defs);

  for (const [name, spec] of Object.entries(tools)) {
    // Read-only authorizations get only the `read` tools; skip the writers.
    if (!write && bindings.get(name)?.op !== 'read') continue;
    // buildTools always produces a z.object; the SDK accepts its raw shape as a
    // ZodRawShapeCompat and does its own JSON-Schema conversion + validation.
    const shape = (spec.inputSchema as z.ZodObject).shape;
    server.registerTool(
      name,
      { description: spec.description, inputSchema: shape },
      async (args: Record<string, unknown>): Promise<CallToolResult> => {
        const out = await executeToolCall({ name, args }, bindings, token);
        return out.ok ? ok(out.result) : err(out.error ?? 'error');
      },
    );
  }

  // Custom methods come after CRUD so the generated names are reserved (a
  // custom verb that would collide with `read_book` or `search_documents` is
  // skipped, not registered twice — a duplicate name throws in the SDK). The
  // CRUD names are reserved whether or not they were registered, so a
  // read-only surface never repurposes a name that means something else on a
  // read-write one.
  const custom = buildCustomMethodTools(
    defs,
    new Set([...Object.keys(tools), SEARCH_TOOL_NAME]),
  );
  for (const [name, spec] of Object.entries(custom.tools)) {
    // Custom methods have side effects unless they're declared `GET`, so they
    // count as writes for a read-only authorization.
    if (!write && custom.bindings.get(name)?.httpMethod !== 'GET') continue;
    const shape = (spec.inputSchema as z.ZodObject).shape;
    server.registerTool(
      name,
      { description: spec.description, inputSchema: shape },
      async (args: Record<string, unknown>): Promise<CallToolResult> => {
        const out = await executeCustomMethod(name, args, custom.bindings, token);
        return out.ok ? ok(out.result) : err(out.error);
      },
    );
  }

  registerSearchTool(server, defs, token);
}

/**
 * Register the six resource-parameterized tools. The surface is flat — adding
 * an app changes what `describe_resources` reports and which values the
 * `resource` enum accepts, not how many tools a client has to hold.
 */
function registerGenericTools(
  server: McpServer,
  defs: ResourceDefinition[],
  token: string,
  write: boolean,
): void {
  const { tools, execute } = buildGenericTools(defs, { write });
  for (const [name, spec] of Object.entries(tools)) {
    const shape = (spec.inputSchema as z.ZodObject).shape;
    server.registerTool(
      name,
      { description: spec.description, inputSchema: shape },
      async (args: Record<string, unknown>): Promise<CallToolResult> => {
        const out = await execute(name, args, token);
        return out.ok ? ok(out.result) : err(out.error);
      },
    );
  }
}

/** The semantic document search, registered only when embeddings are configured. */
function registerSearchTool(
  server: McpServer,
  defs: ResourceDefinition[],
  token: string,
): void {
  const search = makeSearchTool({ defs, token, record: () => {} });
  if (!search) return;
  const shape = (search.inputSchema as z.ZodObject).shape;
  const description =
    typeof search.description === 'string' ? search.description : 'Search uploaded documents.';
  const execute = search.execute!;
  server.registerTool(
    SEARCH_TOOL_NAME,
    { description, inputSchema: shape },
    async (args: Record<string, unknown>): Promise<CallToolResult> => {
      // The tool's execute takes (args, options); our impl ignores options,
      // so a minimal stub cast to the SDK's option type is safe.
      const options = { toolCallId: 'mcp', messages: [] } as unknown as Parameters<
        typeof execute
      >[1];
      const result = await execute(args as Parameters<typeof execute>[0], options);
      return ok(result);
    },
  );
}
