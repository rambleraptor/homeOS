/**
 * Dynamic-resource route resolution. The Go server rebuilt an http.ServeMux
 * whenever definitions changed; here a single dispatcher matches request
 * segments against the registry on every request, so runtime definition
 * changes need no rebuild.
 */

import {
  checkSuperuserWrite,
  checkUserScope,
  handleApply,
  handleCreate,
  handleDelete,
  handleDownload,
  handleGet,
  handleList,
  handleSingletonGet,
  handleSingletonUpdate,
  handleUpdate,
  type RouteMatch,
} from './crud';
import { errorResponse } from './errors';
import type { RegisteredResource, Registry } from './registry';
import type { User } from './types';

/** Go's http.ServeMux fallback for unrouted paths. */
export function notFoundText(): Response {
  return new Response('404 page not found\n', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

function methodNotAllowed(): Response {
  return new Response('Method Not Allowed\n', {
    status: 405,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/**
 * Match request segments against an element pattern. Even positions are
 * literal collection names; odd positions are `{param}` captures. Returns
 * the captured params, or null when literals don't line up.
 */
function matchElems(segments: string[], elems: string[]): Record<string, string> | null {
  const params: Record<string, string> = {};
  for (let i = 0; i < elems.length; i++) {
    const elem = elems[i]!;
    const seg = segments[i]!;
    if (elem.startsWith('{')) {
      if (seg === '') return null;
      params[elem.slice(1, -1)] = decodeURIComponent(seg);
    } else if (elem !== seg) {
      return null;
    }
  }
  return params;
}

interface ResolvedRoute {
  match: RouteMatch;
  /** The raw last segment for resource-kind matches (may carry ":verb"). */
  rawId: string;
}

function resolve(reg: Registry, segments: string[]): ResolvedRoute | null {
  for (const r of reg.dynamic()) {
    if (r.singleton) {
      const elems = reg.singletonRouteElems(r);
      if (segments.length !== elems.length) continue;
      // Last element is the literal singular name; the rest is the parent pattern.
      const params = matchElems(segments, elems);
      if (!params) continue;
      return {
        match: { resource: r, parentIds: params, id: '', verb: '', kind: 'singleton' },
        rawId: '',
      };
    }

    const elems = r.patternElems;
    if (segments.length === elems.length - 1) {
      const params = matchElems(segments, elems.slice(0, -1));
      if (!params) continue;
      return {
        match: { resource: r, parentIds: params, id: '', verb: '', kind: 'collection' },
        rawId: '',
      };
    }
    if (segments.length === elems.length) {
      const params = matchElems(segments.slice(0, -1), elems.slice(0, -1));
      if (!params) continue;
      return {
        match: {
          resource: r,
          parentIds: params,
          id: segments[segments.length - 1]!,
          verb: '',
          kind: 'resource',
        },
        rawId: decodeURIComponent(segments[segments.length - 1]!),
      };
    }
  }
  return null;
}

/**
 * Route a request against the dynamic resources. Returns null when no
 * resource pattern matches (callers fall through to the 404 text).
 */
export async function routeDynamic(
  reg: Registry,
  req: Request,
  segments: string[],
  caller: User | null,
): Promise<Response | null> {
  const resolved = resolve(reg, segments);
  if (!resolved) return null;

  const { match, rawId } = resolved;
  const r: RegisteredResource = match.resource;
  checkUserScope(match, caller);

  if (match.kind === 'singleton') {
    if (req.method === 'GET') return handleSingletonGet(reg, match);
    if (req.method === 'PATCH') {
      checkSuperuserWrite(match, caller);
      return handleSingletonUpdate(reg, match, req);
    }
    return methodNotAllowed();
  }

  if (match.kind === 'collection') {
    if (req.method === 'POST') {
      checkSuperuserWrite(match, caller);
      return handleCreate(reg, match, req);
    }
    if (req.method === 'GET') return handleList(reg, match, req);
    return methodNotAllowed();
  }

  // Resource-kind: GET/POST split a trailing :verb; other methods treat the
  // raw segment as the id (a colon id then simply misses), matching Go.
  const colon = rawId.indexOf(':');
  if ((req.method === 'GET' || req.method === 'POST') && colon >= 0) {
    match.id = rawId.slice(0, colon);
    match.verb = rawId.slice(colon + 1);
  } else {
    match.id = rawId;
  }

  switch (req.method) {
    case 'GET':
      if (match.verb !== '') {
        return errorResponse(404, `custom method "${match.verb}" not found`);
      }
      return handleGet(reg, match);
    case 'POST':
      if (match.verb === '') {
        return errorResponse(405, 'POST is not allowed on individual resources; use PATCH to update');
      }
      if (match.verb === 'download' && r.fileFields.size > 0) {
        return handleDownload(reg, match, req);
      }
      return errorResponse(404, `custom method "${match.verb}" not found`);
    case 'PATCH':
      checkSuperuserWrite(match, caller);
      return handleUpdate(reg, match, req);
    case 'PUT':
      checkSuperuserWrite(match, caller);
      return handleApply(reg, match, req);
    case 'DELETE':
      checkSuperuserWrite(match, caller);
      return handleDelete(reg, match, req);
    default:
      return methodNotAllowed();
  }
}
