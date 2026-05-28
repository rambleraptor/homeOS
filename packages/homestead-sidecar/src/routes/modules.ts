import { Hono } from 'hono';
import { authenticate } from '@rambleraptor/homestead-core/server/aepbase';
import { dispatchModuleWorker } from '@rambleraptor/homestead-core/modules/workers/dispatcher';
import { getModuleWorker } from '../module-registry';

export const modulesRoute = new Hono();

// `:workerName{.*}` captures the rest of the path (including slashes) so a
// worker can be addressed as `/api/modules/<moduleId>/<a/b/c>`.
modulesRoute.all('/:moduleId/:workerName{.*}', (c) =>
  dispatchModuleWorker({
    request: c.req.raw,
    moduleId: c.req.param('moduleId'),
    workerName: c.req.param('workerName'),
    resolveWorker: getModuleWorker,
    authenticate,
  }),
);
