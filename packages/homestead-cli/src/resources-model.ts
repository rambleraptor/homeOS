import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import axios from 'axios';
import { APIClient, Client, logger } from '@aep_dev/aep-lib-ts';
import type { OpenAPI, Resource } from '@aep_dev/aep-lib-ts';
import { loadProject } from './project.ts';

// aep-lib-ts logs OpenAPI parsing at INFO; silence it so command output is clean.
logger.settings.minLevel = 7;

/** How `homestead resources` finds and authenticates to a running aepbase. */
export interface ConnectOptions {
  /** Project directory holding homestead.config.ts + data/. Defaults to CWD. */
  projectDir?: string;
  /** Full aepbase base URL. Wins over `aepbasePort`. */
  serverUrl?: string;
  /** aepbase loopback port (default 8090) when `serverUrl` is not given. */
  aepbasePort?: number;
  /** Full sidecar base URL (serves custom methods). Wins over `sidecarPort`. */
  sidecarUrl?: string;
  /** Sidecar loopback port (default 4000) when `sidecarUrl` is not given. */
  sidecarPort?: number;
  /** Explicit data dir holding credentials.json; overrides the project's. */
  dataDir?: string;
  /** Pre-obtained bearer token; skips login. */
  token?: string;
  /** Superuser email; overrides credentials.json. */
  email?: string;
  /** Superuser password; overrides credentials.json. */
  password?: string;
}

/** An AEP-136 custom method advertised by the sidecar's `/api/custom-methods`. */
export interface CustomMethodInfo {
  /** Plural of the resource the method lives on, e.g. `groceries`. */
  plural: string;
  /** Kebab-case custom verb, e.g. `process-image`. */
  verb: string;
  /** `collection` (`/<plural>:<verb>`) or `item` (`/<plural>/<id>:<verb>`). */
  target: 'collection' | 'item';
  /** HTTP method the sidecar expects (default POST). */
  method: string;
}

/** Everything a verb handler needs to talk to aepbase + the sidecar. */
export interface ResourceContext {
  apiClient: APIClient;
  client: Client;
  serverUrl: string;
  /** Sidecar base URL — where custom methods are invoked. */
  sidecarUrl: string;
  /** Bearer token of the authenticated caller. */
  token: string;
  /** The caller's user id (sent as `X-User-Id` to the custom-method gateway). */
  userId: string;
  /** Resource model keyed by singular, e.g. `gift-card`. */
  resources: Record<string, Resource>;
  /** Custom methods registered on the sidecar, across all resources. */
  customMethods: CustomMethodInfo[];
}

/**
 * A failure to reach or authenticate against aepbase — distinct from a failed
 * CRUD call so the caller can pick the right exit code (1 vs 2).
 */
export class ConnectError extends Error {}

/**
 * Locate the running aepbase, authenticate, fetch its OpenAPI document, and
 * build the aep-lib-ts model + REST client from it. Throws `ConnectError`
 * with an operator-friendly message when the server is unreachable or the
 * schema hasn't been synced yet.
 */
export async function connect(opts: ConnectOptions): Promise<ResourceContext> {
  const serverUrl = resolveServerUrl(opts);
  const sidecarUrl = resolveSidecarUrl(opts);
  await probe(serverUrl);

  const { token, userId } = await resolveAuth(serverUrl, opts);
  const openapi = await fetchOpenApi(serverUrl);

  const apiClient = await APIClient.fromOpenAPI(openapi, serverUrl);
  const resources = apiClient.resources();
  patchCreateMethods(resources, openapi);
  if (Object.keys(resources).length === 0) {
    throw new ConnectError(
      `aepbase at ${serverUrl} serves no resources yet — bring the sidecar up ` +
        'once with AEPBASE_ADMIN_EMAIL/AEPBASE_ADMIN_PASSWORD so the schema syncs.',
    );
  }

  const customMethods = await fetchCustomMethods(sidecarUrl);

  const http = axios.create({ timeout: 30_000 });
  const headers = { Authorization: `Bearer ${token}` };
  const noop = (): void => {};
  const client = new Client(http, headers, noop, noop);

  return {
    apiClient,
    client,
    serverUrl,
    sidecarUrl,
    token,
    userId,
    resources,
    customMethods,
  };
}

/**
 * Fetch the custom methods registered on the sidecar. Best-effort: the
 * `resources` command still works (CRUD only) when the sidecar is down or
 * predates this endpoint, so we degrade to an empty list rather than fail.
 */
async function fetchCustomMethods(
  sidecarUrl: string,
): Promise<CustomMethodInfo[]> {
  try {
    const res = await fetch(`${sidecarUrl}/api/custom-methods`, {
      signal: AbortSignal.timeout(2_000),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { methods?: CustomMethodInfo[] };
    return body.methods ?? [];
  } catch {
    return [];
  }
}

/**
 * aep-lib-ts v0.0.2 only registers a create method when the collection POST
 * declares a `200` response, but aepbase returns `201` — so create is missed
 * for every resource. Re-derive it from the raw OpenAPI: a collection POST
 * means create; an `id` query param means user-settable ids.
 */
function patchCreateMethods(
  resources: Record<string, Resource>,
  openapi: OpenAPI,
): void {
  for (const resource of Object.values(resources)) {
    if (resource.createMethod) continue;
    const collectionPath = `/${resource.patternElems.slice(0, -1).join('/')}`;
    const post = openapi.paths?.[collectionPath]?.post;
    if (!post) continue;
    resource.createMethod = {
      supportsUserSettableCreate:
        post.parameters?.some((p) => p.name === 'id') ?? false,
    };
  }
}

function resolveServerUrl(opts: ConnectOptions): string {
  if (opts.serverUrl) return opts.serverUrl.replace(/\/$/, '');
  const port = opts.aepbasePort ?? 8090;
  return `http://127.0.0.1:${port}`;
}

function resolveSidecarUrl(opts: ConnectOptions): string {
  if (opts.sidecarUrl) return opts.sidecarUrl.replace(/\/$/, '');
  const port = opts.sidecarPort ?? 4000;
  return `http://127.0.0.1:${port}`;
}

/** One-shot reachability check so we fail fast with a clear message. */
async function probe(serverUrl: string): Promise<void> {
  try {
    await fetch(`${serverUrl}/`, { signal: AbortSignal.timeout(2_000) });
  } catch {
    throw new ConnectError(
      `no aepbase listening on ${serverUrl} — is \`homestead start\` running? ` +
        '(override with --server-url or --aepbase-port)',
    );
  }
}

/**
 * Resolve the caller's bearer token + user id. The id is needed for the
 * custom-method gateway's `X-User-Id` header. With `--token` we read it back
 * via aepbase's `/users/me`; otherwise the `:login` response carries it.
 */
async function resolveAuth(
  serverUrl: string,
  opts: ConnectOptions,
): Promise<{ token: string; userId: string }> {
  if (opts.token) {
    return { token: opts.token, userId: await whoami(serverUrl, opts.token) };
  }
  const creds = resolveCredentials(opts);
  return login(serverUrl, creds.email, creds.password);
}

async function whoami(serverUrl: string, token: string): Promise<string> {
  const res = await fetch(`${serverUrl}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new ConnectError(`GET ${serverUrl}/users/me → ${res.status}`);
  }
  const user = (await res.json()) as { id?: string };
  if (!user.id) throw new ConnectError('aepbase /users/me response missing id');
  return user.id;
}

interface Credentials {
  email: string;
  password: string;
}

function resolveCredentials(opts: ConnectOptions): Credentials {
  if (opts.email && opts.password) {
    return { email: opts.email, password: opts.password };
  }
  const dataDir = opts.dataDir ?? loadProject(opts.projectDir ?? '.').dataDir;
  const path = join(dataDir, 'credentials.json');
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new ConnectError(
      `no credentials: pass --email/--password (or --token), or run from a ` +
        `project whose ${path} exists.`,
    );
  }
  const parsed = JSON.parse(raw) as Partial<Credentials>;
  if (!parsed.email || !parsed.password) {
    throw new ConnectError(`${path} is missing email or password`);
  }
  return { email: parsed.email, password: parsed.password };
}

/** POST /users/:login → { token, user }. Captures the user id too. */
async function login(
  serverUrl: string,
  email: string,
  password: string,
): Promise<{ token: string; userId: string }> {
  const res = await fetch(`${serverUrl}/users/:login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ConnectError(`aepbase login → ${res.status}: ${text}`);
  }
  const body = (await res.json()) as { token?: string; user?: { id?: string } };
  if (!body.token || !body.user?.id) {
    throw new ConnectError('aepbase login response missing token or user id');
  }
  return { token: body.token, userId: body.user.id };
}

async function fetchOpenApi(serverUrl: string): Promise<OpenAPI> {
  const res = await fetch(`${serverUrl}/openapi.json`);
  if (!res.ok) {
    throw new ConnectError(`GET ${serverUrl}/openapi.json → ${res.status}`);
  }
  return (await res.json()) as OpenAPI;
}
