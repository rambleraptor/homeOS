/**
 * Server-side aepbase helper for Next.js API routes (compatibility shim).
 *
 * The CRUD primitives used to live here. They now delegate to the shared
 * `Transport` from `@rambleraptor/homestead-aep-client`, constructed
 * per-request with the caller's forwarded bearer token. Phase 2 will
 * migrate server routes to the typed `HomesteadClient`; this shim then
 * goes away.
 *
 * `authenticate(request)` and `aepbaseFetch` stay in this file because
 * Next.js routes still call them directly.
 */

import { NextRequest } from 'next/server';
import {
  Transport,
  bearerAuth,
  type RequestOptions,
} from '@rambleraptor/homestead-aep-client';

/**
 * Base URL of the running aepbase. Matches the `AEPBASE_URL` env var used
 * by `next.config.ts` for the `/api/aep` proxy.
 */
export const AEPBASE_URL =
  process.env.AEPBASE_URL || 'http://127.0.0.1:8090';

export interface AuthedUser {
  id: string;
  path: string;
  email: string;
  display_name?: string;
  type?: string;
}

export interface AuthResult {
  token: string;
  user: AuthedUser;
}

function transportFor(token: string): Transport {
  return new Transport({ baseUrl: AEPBASE_URL, auth: bearerAuth(token) });
}

/**
 * Authenticate a request from the frontend.
 *
 * The client sends two things: an `Authorization: Bearer <token>` header
 * and an `X-User-Id: <user id>` header (the id of the token-holder, which
 * the client already has from the `:login` response).
 *
 * We verify both are consistent by issuing `GET /users/{id}` against
 * aepbase with the token — aepbase returns 200 only when the caller is
 * that user (or a superuser), so a mismatch yields 403/401 and we reject
 * the request. aepbase has no dedicated whoami endpoint today; if one is
 * added upstream we can drop the header dependency.
 */
export async function authenticate(request: NextRequest): Promise<AuthResult | null> {
  const authHeader = request.headers.get('authorization');
  const userId = request.headers.get('x-user-id');
  if (!authHeader || !userId) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  try {
    const user = await transportFor(token).request<AuthedUser>(`/users/${userId}`);
    return { token, user };
  } catch {
    return null;
  }
}

interface FetchOptions {
  token: string;
  method?: string;
  body?: unknown;
  mergePatch?: boolean;
}

/**
 * Low-level fetch against aepbase with a given Bearer token. Used by
 * the higher-level helpers below and by server routes that need direct
 * control over method + path. Returns the raw `Response` for callers
 * that need streaming, headers, or non-JSON bodies.
 */
export async function aepbaseFetch(
  path: string,
  { token, method = 'GET', body, mergePatch }: FetchOptions,
): Promise<Response> {
  const opts: RequestOptions = { method, raw: true };
  if (body !== undefined) {
    opts.body = body;
    opts.mergePatch = mergePatch;
  }
  try {
    return await transportFor(token).request<Response>(path, opts);
  } catch (err) {
    // Legacy callers branch on `res.ok` directly, so we synthesize a
    // failed Response from AepError to preserve that contract instead
    // of letting the error propagate.
    if (err instanceof Error && 'code' in err) {
      const e = err as Error & { code: number };
      return new Response(JSON.stringify({ error: { code: e.code, message: e.message } }), {
        status: e.code,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw err;
  }
}

export type ParentPath = string[];

function pathFor(plural: string, parent?: ParentPath): string {
  if (parent && parent.length > 0) return '/' + parent.join('/') + `/${plural}`;
  return `/${plural}`;
}

interface ListResponseRaw<T> {
  results?: T[];
  next_page_token?: string;
}

export async function aepList<T>(
  plural: string,
  token: string,
  parent?: ParentPath,
): Promise<T[]> {
  const t = transportFor(token);
  const base = pathFor(plural, parent);
  const out: T[] = [];
  let pageToken: string | undefined;
  do {
    const body = await t.request<ListResponseRaw<T>>(base, {
      query: { max_page_size: 200, page_token: pageToken },
    });
    if (body.results) out.push(...body.results);
    pageToken = body.next_page_token || undefined;
  } while (pageToken);
  return out;
}

export async function aepGet<T>(
  plural: string,
  id: string,
  token: string,
  parent?: ParentPath,
): Promise<T> {
  return await transportFor(token).request<T>(`${pathFor(plural, parent)}/${id}`);
}

export async function aepCreate<T>(
  plural: string,
  body: Record<string, unknown>,
  token: string,
  parent?: ParentPath,
): Promise<T> {
  return await transportFor(token).request<T>(pathFor(plural, parent), {
    method: 'POST',
    body,
  });
}

export async function aepUpdate<T>(
  plural: string,
  id: string,
  body: Record<string, unknown>,
  token: string,
  parent?: ParentPath,
): Promise<T> {
  return await transportFor(token).request<T>(`${pathFor(plural, parent)}/${id}`, {
    method: 'PATCH',
    body,
    mergePatch: true,
  });
}

export async function aepRemove(
  plural: string,
  id: string,
  token: string,
  parent?: ParentPath,
): Promise<void> {
  await transportFor(token).request<void>(`${pathFor(plural, parent)}/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Download a file-field's bytes via aepbase's `:download` custom method.
 */
export async function aepDownload(
  plural: string,
  id: string,
  field: string,
  token: string,
  parent?: ParentPath,
): Promise<Response> {
  return aepbaseFetch(`${pathFor(plural, parent)}/${id}:download`, {
    token,
    method: 'POST',
    body: { field },
  });
}
