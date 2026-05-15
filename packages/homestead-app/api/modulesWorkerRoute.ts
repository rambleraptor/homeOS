/**
 * Module worker catch-all route handler.
 *
 * Mounted at `/api/modules/<moduleId>/<workerName>` by the consumer's
 * `app/api/modules/[moduleId]/[...path]/route.ts` (which re-exports
 * the verb handlers below). Wires the registry + `authenticate()`
 * helper into the pure dispatcher; all real resolution + invocation
 * logic lives in `../registry/workers/dispatcher`.
 */

import { NextRequest } from 'next/server';
import { authenticate } from './aepbase-server';
import { getModuleWorker } from '../registry/registry';
import { dispatchModuleWorker } from '../registry/workers/dispatcher';

async function handle(
  request: NextRequest,
  context: { params: Promise<{ moduleId: string; path: string[] }> },
): Promise<Response> {
  const { moduleId, path } = await context.params;
  const workerName = path.join('/');
  return dispatchModuleWorker({
    request,
    moduleId,
    workerName,
    resolveWorker: getModuleWorker,
    authenticate,
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
