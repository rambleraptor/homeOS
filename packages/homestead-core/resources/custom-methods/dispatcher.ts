/**
 * Custom-method dispatcher (AEP-136).
 *
 * Pure function consumed by the sidecar's `/api/v1/aep` gateway route. It owns
 * the colon-verb URLs that live on a resource — `POST /<plural>:<verb>` and
 * `POST /<plural>/<id>:<verb>` — resolving each to an app-declared handler.
 *
 * Runtime-agnostic: it speaks Web `Request`/`Response`, so the same dispatcher
 * works under Bun, Next, or any Fetch-based server, and the wiring (registry
 * lookup, request authentication, aepbase passthrough) can be swapped out in
 * unit tests.
 *
 * Any colon path that isn't a registered custom method (aepbase's own
 * `:login` / `:download`, or a typo) is handed to `passthrough` so it still
 * reaches aepbase unchanged.
 */

import type {
  CustomMethodAuth,
  CustomMethodHandler,
  CustomMethodTarget,
  ResourceCustomMethod,
} from '../types';

export interface DispatchOptions {
  request: Request;
  /**
   * aepbase-relative path (the part after `/api/v1/aep`), e.g.
   * `/grocery-items:process-image` or `/hsa-receipts/abc123:parse-receipt`.
   */
  path: string;
  /** Resolves a custom method by `(plural, verb)`. */
  resolveMethod: (plural: string, verb: string) => ResourceCustomMethod | undefined;
  /** Authenticates the request (custom methods always require auth). */
  authenticate: (request: Request) => Promise<CustomMethodAuth | null>;
  /**
   * Forward a non-custom-method request to aepbase untouched. Called for
   * colon paths that don't resolve to a registered method (`:login`,
   * `:download`, …) so they keep working through the gateway.
   */
  passthrough: (request: Request, path: string) => Promise<Response>;
}

/** A colon URL split into its resource path and trailing custom verb. */
interface ParsedCustomMethod {
  /** The resource the method targets. */
  plural: string;
  target: CustomMethodTarget;
  /** Item id — only present for `item`-target methods. */
  id?: string;
  /** Parent chain as alternating `[plural, id, …]` segments. */
  parent: string[];
  verb: string;
}

/**
 * Split an aepbase-relative path into its resource address + custom verb.
 * Returns `null` when there is no trailing `:verb`. Shape determines the
 * target: an odd number of resource segments is a collection (`.../plural`),
 * an even number is an item (`.../plural/id`).
 */
export function parseCustomMethodPath(path: string): ParsedCustomMethod | null {
  const [resourcePath] = path.split('?', 1);
  const colon = resourcePath.lastIndexOf(':');
  if (colon === -1) return null;
  // The colon must live in the final segment, after the last slash.
  if (resourcePath.indexOf('/', colon) !== -1) return null;

  const verb = resourcePath.slice(colon + 1);
  if (!verb) return null;

  const segments = resourcePath
    .slice(0, colon)
    .split('/')
    .filter((s) => s.length > 0);
  if (segments.length === 0) return null;

  // Odd → collection (plural is the last segment); even → item.
  if (segments.length % 2 === 1) {
    return {
      plural: segments[segments.length - 1],
      target: 'collection',
      parent: segments.slice(0, -1),
      verb,
    };
  }
  return {
    plural: segments[segments.length - 2],
    target: 'item',
    id: segments[segments.length - 1],
    parent: segments.slice(0, -2),
    verb,
  };
}

/**
 * Resolve the custom method, enforce method + auth, then invoke the
 * lazy-loaded handler. Falls back to `passthrough` for colon paths that
 * aren't registered custom methods. Always returns a `Response`; errors
 * thrown by the handler are caught and surfaced as 500.
 */
export async function dispatchCustomMethod({
  request,
  path,
  resolveMethod,
  authenticate,
  passthrough,
}: DispatchOptions): Promise<Response> {
  const parsed = parseCustomMethodPath(path);
  if (!parsed) return passthrough(request, path);

  const method = resolveMethod(parsed.plural, parsed.verb);
  // Not ours (e.g. aepbase's `:login` / `:download`) or a target mismatch —
  // let aepbase have it.
  if (!method || (method.target ?? 'collection') !== parsed.target) {
    return passthrough(request, path);
  }

  const expectedMethod = method.method ?? 'POST';
  if (request.method !== expectedMethod) {
    return Response.json(
      { error: 'Method not allowed', expected: expectedMethod },
      { status: 405, headers: { Allow: expectedMethod } },
    );
  }

  const auth = await authenticate(request);
  if (!auth) {
    return Response.json(
      { error: 'Unauthorized - authentication required' },
      { status: 401 },
    );
  }

  let handler: CustomMethodHandler;
  try {
    const mod = await method.load();
    handler = mod.default;
  } catch (error) {
    console.error(
      `Failed to load custom method ${parsed.plural}:${parsed.verb}:`,
      error,
    );
    return Response.json(
      { error: 'Internal server error', message: 'Failed to load custom method' },
      { status: 500 },
    );
  }

  try {
    return await handler({
      request,
      auth,
      plural: parsed.plural,
      verb: parsed.verb,
      target: parsed.target,
      id: parsed.id,
      parent: parsed.parent,
    });
  } catch (error) {
    console.error(
      `Custom method ${parsed.plural}:${parsed.verb} threw:`,
      error,
    );
    return Response.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
