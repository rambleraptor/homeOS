/**
 * Module worker catch-all route.
 *
 * Mounts every module-declared worker at
 * `/api/modules/<moduleId>/<workerName>`. Wires the registry +
 * `authenticate()` helper into the pure dispatcher; all real
 * resolution + invocation logic lives in
 * `@/modules/workers/dispatcher`.
 */

import { NextRequest } from 'next/server';
import { authenticate } from '../../../_lib/aepbase-server';
import { getModuleWorker } from '@/modules/registry';
import { dispatchModuleWorker } from '@/modules/workers/dispatcher';

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
