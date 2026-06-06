import type { Resource } from '@aep_dev/aep-lib-ts';
import { connect, type ConnectOptions, type ResourceContext } from './resources-model.ts';
import {
  buildBody,
  buildItemPath,
  collectParentParams,
  fieldFlags,
  FlagError,
  parentPlaceholders,
  DATA_FLAG,
  ID_FLAG,
  type RawFlags,
} from './resources-flags.ts';
import { renderIndex, renderResourceHelp, supportedVerbs, type Verb } from './resources-help.ts';

/** Flags consumed by connect/output rather than treated as resource fields. */
const GLOBAL_FLAGS = [
  'server-url',
  'aepbase-port',
  'token',
  'email',
  'password',
  'data-dir',
  'output',
];

const ctx = {};

/**
 * `homestead resources [<resource> [<verb> [<id>]]]` — dynamic CRUD/List over
 * whatever a running aepbase serves. With no resource it prints the index;
 * with a resource but no verb it prints that resource's help.
 */
export async function resourcesCmd(args: string[]): Promise<number> {
  const { flags, positionals } = parseFlags(args);
  const [resourceName, verbArg, idArg] = positionals;

  let model: ResourceContext;
  try {
    model = await connect(connectOptions(flags));
  } catch (err) {
    return fail(err, 1);
  }

  if (!resourceName) {
    console.log(renderIndex(model.resources));
    return 0;
  }

  const resource = resolveResource(model.resources, resourceName);
  if (!resource) {
    console.error(unknownResourceMessage(model.resources, resourceName));
    return 1;
  }

  if (!verbArg) {
    console.log(renderResourceHelp(resource));
    return 0;
  }

  const verbs = supportedVerbs(resource);
  if (!verbs.includes(verbArg as Verb)) {
    console.error(
      `resource "${resource.singular}" has no "${verbArg}" verb — supported: ${verbs.join(', ') || '(none)'}`,
    );
    return 1;
  }

  try {
    const result = await runVerb(model, resource, verbArg as Verb, idArg, flags);
    if (result !== undefined) console.log(JSON.stringify(result, null, 2));
    return 0;
  } catch (err) {
    // Usage problems (bad/missing flags) are the operator's fault → 1;
    // anything else is an aepbase/HTTP failure → 2 (aepcli convention).
    return fail(err, err instanceof FlagError ? 1 : 2);
  }
}

async function runVerb(
  model: ResourceContext,
  resource: Resource,
  verb: Verb,
  idArg: string | undefined,
  flags: RawFlags,
): Promise<unknown> {
  const { client, serverUrl } = model;
  const parentParams = collectParentParams(resource, flags);
  const reserved = reservedFlags(resource);

  switch (verb) {
    case 'list':
      return client.list(ctx, resource, serverUrl, parentParams);
    case 'get':
      return client.get(ctx, serverUrl, buildItemPath(resource, parentParams, requireId(idArg, verb)));
    case 'delete': {
      const path = buildItemPath(resource, parentParams, requireId(idArg, verb));
      await client.delete(ctx, serverUrl, path);
      return { deleted: path };
    }
    case 'create': {
      const body = buildBody(resource, fieldFlags(resource), flags, { forCreate: true, reserved });
      return client.create(ctx, resource, serverUrl, body, parentParams);
    }
    case 'update': {
      const path = buildItemPath(resource, parentParams, requireId(idArg, verb));
      const body = buildBody(resource, fieldFlags(resource), flags, { forCreate: false, reserved });
      return client.update(ctx, serverUrl, path, body);
    }
  }
}

function requireId(idArg: string | undefined, verb: Verb): string {
  if (!idArg) throw new FlagError(`"${verb}" needs an id: homestead resources <resource> ${verb} <id>`);
  return idArg;
}

/** Body-field flags are everything except globals, parents, --@data and --id. */
function reservedFlags(resource: Resource): Set<string> {
  return new Set([...GLOBAL_FLAGS, ...parentPlaceholders(resource), DATA_FLAG, ID_FLAG]);
}

function connectOptions(flags: RawFlags): ConnectOptions {
  return {
    serverUrl: str(flags['server-url']),
    aepbasePort: num(flags['aepbase-port']),
    dataDir: str(flags['data-dir']),
    token: str(flags.token),
    email: str(flags.email),
    password: str(flags.password),
  };
}

/** Resolve a name (singular or plural) to its resource. */
function resolveResource(
  resources: Record<string, Resource>,
  name: string,
): Resource | undefined {
  for (const r of Object.values(resources)) {
    if (r.singular === name || r.plural === name) return r;
  }
  return undefined;
}

function unknownResourceMessage(
  resources: Record<string, Resource>,
  name: string,
): string {
  const names = Object.values(resources).map((r) => r.singular);
  const near = names.filter((n) => n.includes(name) || name.includes(n));
  const hint = near.length > 0 ? ` Did you mean: ${near.join(', ')}?` : '';
  return `unknown resource "${name}".${hint} Run \`homestead resources\` to list them.`;
}

function fail(err: unknown, code: number): number {
  const raw = err instanceof Error ? err.message : String(err);
  // aep-lib-ts client errors are "Request failed: <body> for request <config>"
  // — the trailing config echoes our bearer token, so drop it.
  const message = raw.replace(/ for request \{.*$/s, '');
  console.error(message);
  return code;
}

interface ParsedFlags {
  flags: RawFlags;
  positionals: string[];
}

/** Minimal flag parser: --flag, --flag=value, --flag value (mirrors cli.ts). */
function parseFlags(args: string[]): ParsedFlags {
  const flags: RawFlags = {};
  const positionals: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) {
      positionals.push(a);
      continue;
    }
    const eq = a.indexOf('=');
    if (eq !== -1) {
      flags[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }
    const name = a.slice(2);
    const next = args[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[name] = next;
      i++;
    } else {
      flags[name] = true;
    }
  }
  return { flags, positionals };
}

function str(v: string | boolean | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function num(v: string | boolean | undefined): number | undefined {
  if (typeof v !== 'string') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
