/**
 * Module worker dispatcher.
 *
 * Pure function consumed by the sidecar's `/api/modules/:moduleId/*`
 * route. Runtime-agnostic — it speaks Web `Request`/`Response`, so the
 * same dispatcher works under Bun, Next, or any Fetch-based server, and
 * the wiring (registry lookup, request authentication) can be swapped
 * out in unit tests.
 */

import type {
  ModuleWorker,
  ModuleWorkerAuth,
  ModuleWorkerHandler,
} from '../types';

export interface DispatchOptions {
  request: Request;
  moduleId: string;
  workerName: string;
  /** Looks up a worker by `(moduleId, workerName)`. */
  resolveWorker: (moduleId: string, name: string) => ModuleWorker | undefined;
  /** Authenticates the request when the worker requires it. */
  authenticate: (request: Request) => Promise<ModuleWorkerAuth | null>;
}

/**
 * Resolve the worker, enforce method + auth, then invoke the
 * lazy-loaded handler. Always returns a `Response`; errors thrown
 * by the handler are caught and surfaced as 500.
 */
export async function dispatchModuleWorker({
  request,
  moduleId,
  workerName,
  resolveWorker,
  authenticate,
}: DispatchOptions): Promise<Response> {
  const worker = resolveWorker(moduleId, workerName);
  if (!worker) {
    return Response.json(
      { error: 'Worker not found', moduleId, workerName },
      { status: 404 },
    );
  }

  const expectedMethod = worker.method ?? 'POST';
  if (request.method !== expectedMethod) {
    return Response.json(
      { error: 'Method not allowed', expected: expectedMethod },
      { status: 405, headers: { Allow: expectedMethod } },
    );
  }

  let auth: ModuleWorkerAuth | null = null;
  if (worker.requireAuth !== false) {
    auth = await authenticate(request);
    if (!auth) {
      return Response.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 },
      );
    }
  }

  let handler: ModuleWorkerHandler;
  try {
    const mod = await worker.load();
    handler = mod.default;
  } catch (error) {
    console.error(
      `Failed to load worker ${moduleId}/${workerName}:`,
      error,
    );
    return Response.json(
      { error: 'Internal server error', message: 'Failed to load worker' },
      { status: 500 },
    );
  }

  try {
    return await handler({ request, auth, moduleId, workerName });
  } catch (error) {
    console.error(`Worker ${moduleId}/${workerName} threw:`, error);
    return Response.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
