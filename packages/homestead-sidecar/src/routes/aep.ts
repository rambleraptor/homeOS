/**
 * aepbase gateway — owns the AEP-136 custom-method URLs that live on a
 * resource (`POST /<plural>:<verb>` and `POST /<plural>/<id>:<verb>`).
 *
 * The edge/vite proxy forwards any `/api/aep/...:verb` request here. We
 * dispatch the ones that resolve to a module-declared custom method and
 * transparently reverse-proxy the rest (aepbase's own `:login` / `:download`,
 * or anything else) straight to aepbase, so the gateway is the single front
 * door for custom methods without breaking aepbase's built-ins.
 */

import { Hono } from 'hono';
import { authenticate, AEPBASE_URL } from '@rambleraptor/homestead-core/server/aepbase';
import { dispatchCustomMethod } from '@rambleraptor/homestead-core/resources/custom-methods/dispatcher';
import { getResourceCustomMethod } from '../module-registry';

export const aepRoute = new Hono();

const PREFIX = '/api/aep';

aepRoute.all('/*', (c) => {
  const url = new URL(c.req.url);
  // The aepbase-relative path (everything after `/api/aep`), query included.
  const path = url.pathname.slice(PREFIX.length) + url.search;
  return dispatchCustomMethod({
    request: c.req.raw,
    path,
    resolveMethod: getResourceCustomMethod,
    authenticate,
    passthrough,
  });
});

/** Reverse-proxy an untouched request to aepbase, preserving method/body. */
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
  return fetch(`${AEPBASE_URL}${path}`, init);
}
