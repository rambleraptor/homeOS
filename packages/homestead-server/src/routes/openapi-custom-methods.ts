/**
 * Inject app-declared AEP-136 custom methods into the engine's OpenAPI doc.
 *
 * The engine generates `/openapi.json` from its own resource registry and has
 * no knowledge of custom methods — those are a server-layer concept, declared
 * in app configs and dispatched by the `/api/aep` gateway. So the gateway
 * enriches the doc on the way out: for each registered custom method it adds a
 * `/<resource-path>:<verb>` path, mirroring how the engine already emits its
 * built-in `:download` method.
 *
 * Pure and self-contained: it reads the finished doc, reconstructs each path's
 * parameters from the existing resource path template, and mutates `paths` in
 * place. Anything it can't place (a method whose resource isn't in the doc) is
 * skipped, never thrown.
 */

import type { ResourceCustomMethod } from '@rambleraptor/homestead-core/resources/types';

interface OpenApiDoc {
  paths: Record<string, unknown>;
  [key: string]: unknown;
}

/** Extract the `{name}` path parameters from a path template, in order. */
function pathParamsOf(pathKey: string): Array<Record<string, unknown>> {
  const names = [...pathKey.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  return names.map((name) => ({
    in: 'path',
    name,
    required: true,
    schema: { type: 'string' },
  }));
}

/**
 * Find the base resource path a custom method attaches to. Plurals are globally
 * unique, so the collection path is the key whose final segment is the plural;
 * the item path is that key plus a single `/{…}` id segment.
 */
function findBasePath(
  paths: Record<string, unknown>,
  plural: string,
  target: 'collection' | 'item',
): string | undefined {
  const keys = Object.keys(paths);
  const collection = keys.find((k) => {
    if (k.includes(':')) return false;
    const segs = k.split('/');
    return segs[segs.length - 1] === plural;
  });
  if (!collection) return undefined;
  if (target === 'collection') return collection;

  const prefix = `${collection}/{`;
  return keys.find(
    (k) =>
      !k.includes(':') &&
      k.startsWith(prefix) &&
      /^\{[^/]+\}$/.test(k.slice(collection.length + 1)),
  );
}

/** A stable, valid operationId for a custom method. */
function operationId(plural: string, verb: string): string {
  return `${verb}_${plural}`.replace(/[^a-zA-Z0-9]/g, '_');
}

/**
 * Mutate `doc.paths` in place, adding one path per custom method. `methods` is
 * the `${plural}:${verb}` → definition map (declared + synthesized bulk-import),
 * exactly as `/api/custom-methods` reports it.
 */
export function injectCustomMethods(
  doc: OpenApiDoc,
  methods: Record<string, ResourceCustomMethod>,
): OpenApiDoc {
  if (!doc || typeof doc !== 'object' || !doc.paths) return doc;

  for (const [key, def] of Object.entries(methods)) {
    const [plural, verb] = key.split(':', 2);
    if (!plural || !verb) continue;

    const target = def.target ?? 'collection';
    const basePath = findBasePath(doc.paths, plural, target);
    if (!basePath) {
      // Resource not in the doc (e.g. not yet synced) — skip rather than emit a
      // dangling path.
      console.warn(
        `[openapi] skipping custom method ${key}: no base path for "${plural}"`,
      );
      continue;
    }

    const httpMethod = (def.method ?? 'POST').toLowerCase();
    const operation: Record<string, unknown> = {
      operationId: operationId(plural, verb),
      description: def.description ?? `Custom method ${verb} on ${plural}.`,
      tags: [plural],
      parameters: pathParamsOf(basePath),
    };

    if (def.request) {
      operation.requestBody = {
        required: false,
        content: { 'application/json': { schema: def.request } },
      };
    }

    if (def.async) {
      operation.responses = {
        '202': {
          description: 'Long-running operation started.',
          content: { 'application/json': { schema: { type: 'object' } } },
        },
      };
      operation['x-aep-long-running-operation'] = {
        response: { schema: def.response ?? { type: 'object' } },
      };
    } else {
      operation.responses = {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': { schema: def.response ?? { type: 'object' } },
          },
        },
      };
    }

    doc.paths[`${basePath}:${verb}`] = { [httpMethod]: operation };
  }

  return doc;
}
