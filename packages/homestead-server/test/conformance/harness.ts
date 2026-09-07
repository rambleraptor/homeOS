/**
 * Shared harness for the credential-conformance matrix.
 *
 * The point of the matrix is that a credential's authority must not depend on
 * which door it walks through. So every surface here — engine CRUD, the
 * `/api/aep` gateway (which is also what the CLI speaks), the chat tool
 * executor, and the MCP server — is driven against **one** in-memory engine
 * holding **one** set of credentials, and each reports the same three-valued
 * verdict. A disagreement between two surfaces on the same (credential,
 * operation) pair is the bug the matrix exists to catch.
 *
 * The seam that makes this possible is `globalThis.fetch`: `serverClient` and
 * `authenticate` reach the engine over loopback at `AEPBASE_URL`, so
 * {@link installEngineFetch} routes that prefix straight into `engine.fetch`.
 * Everything downstream — the chat executor, the gateway's authenticator, the
 * MCP tool bodies — then runs against the real engine with real enforcement,
 * with no mocking of the permission layer itself.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { AEPBASE_URL } from '@rambleraptor/homestead-core/server/aepbase';
import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';
import { buildTools } from '@rambleraptor/homestead-core/server/chat/tools';
import { executeToolCall } from '@rambleraptor/homestead-core/server/chat/execute';
import type { AuthServerConfig } from '@rambleraptor/homestead-core/apps/config';
import { Engine } from '../../src/engine/engine';
import { AuthService } from '../../src/auth/service';
import { createOAuthTables } from '../../src/auth/oauth/storage';
import { makeMcpRoute, mcpAudience } from '../../src/routes/mcp';
import { makeTokensRoute } from '../../src/routes/tokens';
import { insertToken } from '../../src/engine/users';
import { generatePatSecret } from '../../src/engine/pat';
import { MCP_SCOPE_READ, MCP_SCOPE_WRITE } from '../../src/auth/scopes';
import { call, defineResource, makeEngine, seedOpenHousehold, seedUser, type TestEngine } from '../engine/helpers';

const HERE = dirname(fileURLToPath(import.meta.url));

export const ORIGIN = 'http://localhost:8090';

export const AUTH_CFG: AuthServerConfig = {
  enabled: true,
  issuerUrl: 'https://home.example.com',
  scopesSupported: [MCP_SCOPE_READ, MCP_SCOPE_WRITE],
};

/**
 * The resource the matrix exercises. Deliberately a plain top-level collection:
 * grant enforcement is at its most ordinary here, so any surface that disagrees
 * is disagreeing about the credential, not about an exotic resource shape.
 */
export const BOOK_DEF: ResourceDefinition = {
  singular: 'book',
  plural: 'books',
  fields: {
    title: { type: 'string', required: true },
  },
};

/** The engine wire form of {@link BOOK_DEF}, for the meta API. */
const BOOK_WIRE = {
  singular: 'book',
  plural: 'books',
  user_settable_create: true,
  schema: {
    type: 'object',
    properties: { title: { type: 'string' } },
    required: ['title'],
  },
};

/**
 * What a surface reports back for one (credential, operation) attempt.
 *
 *  - `allow`           — the operation went through.
 *  - `deny`            — the credential authenticated but was refused (403).
 *  - `unauthenticated` — the surface would not accept the credential at all
 *                        (401). Structurally different from a denial: it means
 *                        "wrong kind of credential for this door", not "this
 *                        credential may not do that".
 */
export type Verdict = 'allow' | 'deny' | 'unauthenticated';

/** Map an HTTP status from any surface onto the shared verdict vocabulary. */
export function verdictOf(status: number): Verdict {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'deny';
  if (status >= 200 && status < 300) return 'allow';
  throw new Error(`unexpected status ${status} — not an authorization outcome`);
}

/** One credential under test, plus how it was minted. */
export interface Credential {
  label: string;
  token: string;
  userId: string;
}

export interface ConformanceHarness {
  t: TestEngine;
  auth: AuthService;
  /** The regular user every non-superuser credential belongs to. */
  userId: string;
  credentials: Record<string, Credential>;
  /** `/api/aep` gateway app — the door the CLI and the SPA both use. */
  gateway: Hono;
  /** `/api/mcp` app, mounted with the route's default (per-resource) surface. */
  mcp: Hono;
  /** `/api/tokens` app — PAT minting. */
  tokens: Hono;
  dispose: () => void;
}

/**
 * Point `globalThis.fetch` at `engine.fetch` for anything addressed to
 * {@link AEPBASE_URL}, leaving every other URL on the real implementation.
 * Returns the restore function.
 */
export function installEngineFetch(engine: Engine): () => void {
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(AEPBASE_URL)) return real(input as RequestInfo, init);
    const target = `${ORIGIN}${url.slice(AEPBASE_URL.length)}`;
    // Preserve an already-built Request (headers + body) when there's no init.
    const req =
      input instanceof Request && !init
        ? new Request(target, input)
        : new Request(target, init);
    return engine.fetch(req);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = real;
  };
}


/**
 * Load the `/api/aep` gateway, pointing the app registry at a minimal config
 * first.
 *
 * `src/app-registry.js` resolves the operator's `homestead.config.ts` with a
 * top-level await the moment it is imported, and the gateway imports it. Left
 * alone it finds the repo-root config (and every React app behind it) or, under
 * vitest, nothing at all — so the env has to be set before the import, which is
 * why this is dynamic. The app-discovery env vars are pinned at a path that
 * does not exist so auto-discovery stays deterministic regardless of the
 * runner's cwd (and of an operator's own HOMESTEAD_APPS_DIRS).
 */
async function loadGateway(): Promise<typeof import('../../src/routes/aep-gateway')['makeAepGateway']> {
  process.env.HOMESTEAD_CONFIG ??= join(HERE, '..', 'fixtures', 'minimal-homestead.config.ts');
  process.env.HOMESTEAD_APPS_DIR ??= join(HERE, '..', 'fixtures', 'no-such-apps-dir');
  process.env.HOMESTEAD_APPS_DIRS ??= join(HERE, '..', 'fixtures', 'no-such-apps-dir');
  const mod = await import('../../src/routes/aep-gateway');
  return mod.makeAepGateway;
}

/** Mint a PAT for `userId` carrying exactly the given collection capability. */
async function mintPat(
  t: TestEngine,
  userId: string,
  patId: string,
  capability: 'read' | 'write',
): Promise<string> {
  const secret = generatePatSecret();
  insertToken(t.engine.db, secret, userId, null, patId);
  const res = await call(t.engine, 'POST', '/access-grants', {
    token: t.adminToken,
    body: {
      subject_type: 'token',
      subject_id: patId,
      capability,
      effect: 'allow',
      target_scope: 'collection',
      resource_type: 'book',
    },
  });
  if (res.status !== 201) throw new Error(`mintPat: grant → ${res.status}`);
  t.engine.reloadPermissions();
  return secret;
}

/**
 * Build the harness: one engine, an open household baseline (so the *owner*
 * side allows everything and the credential's own scope is the only variable),
 * a `book` collection, and one credential of each kind for a single regular
 * user — plus a superuser session for the break-glass row.
 */
export async function makeConformanceHarness(): Promise<ConformanceHarness> {
  const t = await makeEngine();
  createOAuthTables(t.engine.db);
  const auth = new AuthService(t.engine.db);

  await seedOpenHousehold(t);
  const defined = await defineResource(t, BOOK_WIRE);
  if (!defined.ok) throw new Error(`book definition → ${defined.status}`);

  const { user, token: sessionToken } = await seedUser(t.engine, { email: 'member@example.com' });

  const audience = mcpAudience(AUTH_CFG.issuerUrl);
  const credentials: Record<string, Credential> = {
    session: { label: 'session', token: sessionToken, userId: user.id },
    'pat-read': {
      label: 'pat-read',
      token: await mintPat(t, user.id, 'pat-read', 'read'),
      userId: user.id,
    },
    'pat-write': {
      label: 'pat-write',
      token: await mintPat(t, user.id, 'pat-write', 'write'),
      userId: user.id,
    },
    'oauth-read': {
      label: 'oauth-read',
      token: auth.issueSession(user.id, { scope: MCP_SCOPE_READ, audience }).access_token,
      userId: user.id,
    },
    'oauth-write': {
      label: 'oauth-write',
      token: auth.issueSession(user.id, { scope: MCP_SCOPE_WRITE, audience }).access_token,
      userId: user.id,
    },
    superuser: { label: 'superuser', token: t.adminToken, userId: t.admin.id },
  };

  const dispose = installEngineFetch(t.engine);

  const makeAepGateway = await loadGateway();
  const gateway = new Hono();
  gateway.route('/api/aep', makeAepGateway(t.engine, ORIGIN));

  const mcp = new Hono();
  mcp.route('/api/mcp', makeMcpRoute(t.engine, AUTH_CFG, () => [BOOK_DEF]));

  const tokens = new Hono();
  tokens.route('/api/tokens', makeTokensRoute(t.engine));

  return { t, auth, userId: user.id, credentials, gateway, mcp, tokens, dispose };
}

// ─────────────────────────── surface drivers ───────────────────────────

/** Direct engine CRUD — the enforcement point every other surface sits on. */
export const engineSurface = {
  name: 'engine',
  async read(h: ConformanceHarness, c: Credential): Promise<Verdict> {
    return verdictOf((await call(h.t.engine, 'GET', '/books', { token: c.token })).status);
  },
  async write(h: ConformanceHarness, c: Credential): Promise<Verdict> {
    const res = await call(h.t.engine, 'POST', '/books', {
      token: c.token,
      body: { title: `by ${c.label}` },
    });
    return verdictOf(res.status);
  },
};

/** The `/api/aep` gateway — what the CLI and the SPA both talk to. */
export const gatewaySurface = {
  name: 'gateway',
  async read(h: ConformanceHarness, c: Credential): Promise<Verdict> {
    const res = await h.gateway.request('/api/aep/books', {
      headers: { Authorization: `Bearer ${c.token}` },
    });
    return verdictOf(res.status);
  },
  async write(h: ConformanceHarness, c: Credential): Promise<Verdict> {
    const res = await h.gateway.request('/api/aep/books', {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `by ${c.label}` }),
    });
    return verdictOf(res.status);
  },
};

/**
 * The AI chat's tool executor. It never throws — a refusal comes back as
 * `{ ok: false, error }` — so the verdict is read out of the error text the
 * model would have seen.
 */
export const chatSurface = {
  name: 'chat',
  async read(h: ConformanceHarness, c: Credential): Promise<Verdict> {
    return chatVerdict('read_book', {}, c);
  },
  async write(h: ConformanceHarness, c: Credential): Promise<Verdict> {
    return chatVerdict('create_book', { title: `by ${c.label}` }, c);
  },
};

async function chatVerdict(
  name: string,
  args: Record<string, unknown>,
  c: Credential,
): Promise<Verdict> {
  const { tools, bindings } = buildTools([BOOK_DEF]);
  if (!(name in tools)) throw new Error(`chat surface has no tool "${name}"`);
  const out = await executeToolCall({ name, args }, bindings, c.token);
  if (out.ok) return 'allow';
  return verdictFromError(out.error ?? '');
}

/**
 * Recover a verdict from a client-library error string. `HomesteadError`
 * messages carry the status, which is what the surfaces above read directly.
 */
export function verdictFromError(message: string): Verdict {
  if (/\b401\b|unauthor/i.test(message)) return 'unauthenticated';
  if (/\b403\b|do not have access|not scoped/i.test(message)) return 'deny';
  throw new Error(`unexpected tool error — not an authorization outcome: ${message}`);
}

/**
 * The MCP server, driven over its real HTTP route so the OAuth scope check in
 * `makeMcpRoute` is part of what's under test.
 *
 * Driven through the surface the route serves by default — `resource`, one tool
 * per resource with the verb as an `action` parameter — because what the matrix
 * has to pin is what a real client is handed.
 *
 * MCP expresses a refusal three ways, and all count as `deny`. An engine-level
 * refusal comes back as the 403 text inside an `isError` result. A scope
 * withheld the *tool* (how `typed` and `generic` enforce read-only) makes the
 * call come back "Tool ... not found". A scope withheld the *action* (how
 * `resource` enforces it, since the tool is the resource and can't be withheld)
 * fails the tool's own action enum. Treating all three as denials is the whole
 * point — that is how MCP enforces a read-only scope, so the matrix has to
 * compare it against what the other surfaces do with the same token.
 */
export const mcpSurface = {
  name: 'mcp',
  async read(h: ConformanceHarness, c: Credential): Promise<Verdict> {
    return mcpVerdict(h, c, 'books', { action: 'list' });
  },
  async write(h: ConformanceHarness, c: Credential): Promise<Verdict> {
    return mcpVerdict(h, c, 'books', { action: 'create', fields: { title: `by ${c.label}` } });
  },
};

/** Raw JSON-RPC round-trip against the mounted `/api/mcp` route. */
export async function mcpRpc(
  h: ConformanceHarness,
  token: string,
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const res = await h.mcp.request('/api/mcp', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    // Streamable HTTP may frame the payload as an SSE `data:` line.
    const line = text.startsWith('data:')
      ? text.slice(text.indexOf('data:') + 5).split('\n')[0]!
      : text;
    json = JSON.parse(line) as Record<string, unknown>;
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function mcpVerdict(
  h: ConformanceHarness,
  c: Credential,
  name: string,
  args: Record<string, unknown>,
): Promise<Verdict> {
  const { status, json } = await mcpRpc(h, c.token, {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name, arguments: args },
  });
  if (status === 401) return 'unauthenticated';
  if (status !== 200) throw new Error(`MCP tools/call → ${status}`);
  const result = (json?.result ?? {}) as { isError?: boolean; content?: { text?: string }[] };
  if (!result.isError) return 'allow';
  const text = result.content?.[0]?.text ?? '';
  // A tool the caller's scope withheld never got registered.
  if (/not found/i.test(text)) return 'deny';
  // An action the caller's scope withheld isn't in the tool's action enum, so
  // the call fails validation — either the SDK's, or the executor's own check.
  if (/invalid arguments|unknown action/i.test(text)) return 'deny';
  return verdictFromError(text);
}

/** Every surface the matrix compares, in the order they are reported. */
export interface SurfaceDriver {
  name: string;
  read(h: ConformanceHarness, c: Credential): Promise<Verdict>;
  write(h: ConformanceHarness, c: Credential): Promise<Verdict>;
}

export const SURFACES: SurfaceDriver[] = [
  engineSurface,
  gatewaySurface,
  chatSurface,
  mcpSurface,
];

/**
 * Define the built-in `personal-access-token` collection on the harness engine.
 *
 * It is a child of `user`, which makes it the resource the subtree tests need,
 * and it is what `/api/tokens` writes into, which makes it the resource the
 * mint-escalation test needs. Both want the *real* definition rather than a
 * stand-in, since the behaviour under test is a property of how the router
 * treats user-parented resources.
 */
export async function definePatResource(t: TestEngine): Promise<void> {
  const { BUILTIN_RESOURCE_DEFS } = await import(
    '@rambleraptor/homestead-core/resources/builtins'
  );
  const { toWireSchema } = await import('@rambleraptor/homestead-core/resources/translate');
  const def = BUILTIN_RESOURCE_DEFS.find((d) => d.singular === 'personal-access-token');
  if (!def) throw new Error('personal-access-token builtin not found');
  const res = await defineResource(t, {
    singular: def.singular,
    plural: def.plural,
    parents: def.parents ?? [],
    user_settable_create: true,
    schema: toWireSchema(def.fields, def.singular),
  });
  if (!res.ok) throw new Error(`personal-access-token definition → ${res.status}`);
}

/**
 * Mint a PAT carrying one arbitrary grant, for tests that need a token scoped
 * differently from the matrix's fixed read/write pair. `targetScope` of `all`
 * ignores `resource_type`, giving a token with blanket authority.
 */
export async function mintPatWithScope(
  h: ConformanceHarness,
  patId: string,
  capability: 'read' | 'write' | 'manage',
  targetScope: 'all' | 'collection',
  resourceType = 'book',
): Promise<string> {
  const secret = generatePatSecret();
  insertToken(h.t.engine.db, secret, h.userId, null, patId);
  const res = await call(h.t.engine, 'POST', '/access-grants', {
    token: h.t.adminToken,
    body: {
      subject_type: 'token',
      subject_id: patId,
      capability,
      effect: 'allow',
      target_scope: targetScope,
      ...(targetScope === 'collection' ? { resource_type: resourceType } : {}),
    },
  });
  if (!res.ok) throw new Error(`mintPatWithScope: grant → ${res.status}`);
  h.t.engine.reloadPermissions();
  return secret;
}
