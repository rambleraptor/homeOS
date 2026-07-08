/**
 * /api/v1/aep gateway — owns the AEP-136 custom-method URLs that live on a
 * resource (`POST /<plural>:<verb>` and `POST /<plural>/<id>:<verb>`),
 * dispatching app-declared handlers and passing everything else (aepbase's
 * own `:login`/`:download`, plain CRUD) to the engine **in-process** — no
 * loopback hop.
 */

import { Hono } from 'hono';
import { authenticate } from '@rambleraptor/homestead-core/server/aepbase';
import { dispatchCustomMethod } from '@rambleraptor/homestead-core/resources/custom-methods/dispatcher';
import { getResourceCustomMethod } from '../app-registry';
import type { Engine } from '../engine/engine';

const PREFIX = '/api/v1/aep';

export function makeAepGateway(engine: Engine, engineOrigin: string): Hono {
  const gateway = new Hono();

  /**
   * Hand an untouched request to the engine, preserving method/body. The
   * engine only reads the request's pathname + query; `engineOrigin` just
   * makes the URL absolute so `new Request(...)` can parse it.
   */
  function passthrough(request: Request, path: string): Promise<Response> {
    const init: RequestInit & { duplex?: 'half' } = {
      method: request.method,
      headers: request.headers,
      redirect: 'manual',
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body;
      init.duplex = 'half';
    }
    return engine.fetch(new Request(`${engineOrigin}${path}`, init));
  }

  gateway.all('/*', (c) => {
    const url = new URL(c.req.url);
    // The engine-relative path (everything after `/api/v1/aep`), query included.
    const path = url.pathname.slice(PREFIX.length) + url.search;
    return dispatchCustomMethod({
      request: c.req.raw,
      path,
      resolveMethod: getResourceCustomMethod,
      authenticate,
      passthrough,
    });
  });

  return gateway;
}
