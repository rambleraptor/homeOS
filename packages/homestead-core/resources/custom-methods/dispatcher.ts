/**
 * Custom-method dispatcher (AEP-136).
 *
 * Pure function consumed by the sidecar's `/api/aep` gateway route. It owns
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
  AsyncCustomMethodHandler,
  CustomMethodAuth,
  CustomMethodHandler,
  CustomMethodContext,
  CustomMethodTarget,
  ResourceCustomMethod,
} from '../types';
import type { OperationStore } from '../operations';

export interface DispatchOptions {
  request: Request;
  /**
   * aepbase-relative path (the part after `/api/aep`), e.g.
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
  /**
   * AEP-151 operation store. Required only to dispatch `async: true` methods
   * (the gateway always injects it); omit it in tests that exercise only sync
   * methods.
   */
  operations?: OperationStore;
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
  operations,
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

  let handler: CustomMethodHandler | AsyncCustomMethodHandler;
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

  const ctx: CustomMethodContext = {
    request,
    auth,
    plural: parsed.plural,
    verb: parsed.verb,
    target: parsed.target,
    id: parsed.id,
    parent: parsed.parent,
  };

  // AEP-151 async method: create the operation, reply 202 immediately, and run
  // the handler in the background — its result becomes `response`, a throw
  // becomes `error`.
  if (method.async) {
    if (!operations) {
      console.error(
        `Async custom method ${parsed.plural}:${parsed.verb} dispatched without an operation store`,
      );
      return Response.json(
        { error: 'Internal server error', message: 'Async methods are not configured' },
        { status: 500 },
      );
    }
    return dispatchAsync(ctx, handler as AsyncCustomMethodHandler, operations);
  }

  try {
    return await (handler as CustomMethodHandler)(ctx);
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

/**
 * Kick off an async method: create a pending operation, return `202` with it,
 * and let the handler run detached. On settle, record the result (or error)
 * against the operation so pollers see `done: true`.
 */
async function dispatchAsync(
  ctx: CustomMethodContext,
  handler: AsyncCustomMethodHandler,
  operations: OperationStore,
): Promise<Response> {
  const methodName = `${ctx.plural}:${ctx.verb}`;
  let operation;
  try {
    operation = await operations.create({
      token: ctx.auth.token,
      method: methodName,
      createdBy: ctx.auth.user.id,
    });
  } catch (error) {
    console.error(`Failed to create operation for ${methodName}:`, error);
    return Response.json(
      { error: 'Internal server error', message: 'Failed to start operation' },
      { status: 500 },
    );
  }

  // The handler runs after we've answered with 202, so the original request
  // body stream may no longer be readable. Buffer it into a fresh Request the
  // background handler can safely consume.
  const bgCtx: CustomMethodContext = { ...ctx, request: await bufferRequest(ctx.request) };

  // Fire-and-forget: the request has already been answered with 202.
  void (async () => {
    try {
      const response = await handler(bgCtx);
      await operations.complete({ token: ctx.auth.token, id: operation.id, response });
    } catch (error) {
      console.error(`Async custom method ${methodName} threw:`, error);
      try {
        await operations.complete({ token: ctx.auth.token, id: operation.id, error });
      } catch (recordError) {
        console.error(`Failed to record failure for operation ${operation.id}:`, recordError);
      }
    }
  })();

  return Response.json(operation, { status: 202 });
}

/**
 * Buffer a request's body into a fresh, replayable Request. An async handler
 * runs after the 202 response is sent, by which point the original streaming
 * body may be gone — reading the bytes eagerly here keeps `request.json()`
 * working inside the handler. Bodyless methods are returned untouched.
 */
async function bufferRequest(request: Request): Promise<Request> {
  if (request.method === 'GET' || request.method === 'HEAD') return request;
  const body = await request.arrayBuffer();
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body,
  });
}
