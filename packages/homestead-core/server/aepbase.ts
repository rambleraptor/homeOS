/**
 * Server-side aepbase helper.
 *
 * The browser wrapper at `core/api/aepbase` is tuned for client-side use
 * (localStorage, same-origin `/api/aep` proxy). Server code (the sidecar's
 * API routes and app workers) needs to talk directly to aepbase over
 * the network with the user's forwarded bearer token, so it uses this
 * tiny helper instead.
 *
 * Runtime-agnostic: takes a Web `Request`, so it works under Next, Bun,
 * and any Fetch-based server.
 */

/**
 * Base URL of the running aepbase. Matches the `AEPBASE_URL` env var used
 * for the `/api/aep` proxy.
 */
export const AEPBASE_URL = process.env.AEPBASE_URL || 'http://127.0.0.1:8090';

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

/**
 * Authenticate a request from the frontend.
 *
 * The client sends an `Authorization: Bearer <token>` header. We resolve
 * the token-holder server-side via the engine's `GET /users/me` whoami,
 * which returns 200 only for a valid token. This deliberately does *not*
 * trust the client-supplied `X-User-Id` header: that header is empty
 * whenever the browser holds a valid token but its in-memory auth model
 * isn't populated (e.g. localStorage has the token but the user object is
 * missing/stale), which previously yielded a spurious 401 even though the
 * same token works for direct engine CRUD.
 */
export async function authenticate(request: Request): Promise<AuthResult | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  try {
    const res = await aepbaseFetch('/users/me', { token });
    if (!res.ok) return null;
    const user = (await res.json()) as AuthedUser;
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
 * control over method + path.
 */
export async function aepbaseFetch(
  path: string,
  { token, method = 'GET', body, mergePatch }: FetchOptions,
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  let payload: BodyInit | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = mergePatch
      ? 'application/merge-patch+json'
      : 'application/json';
    payload = JSON.stringify(body);
  }
  return fetch(`${AEPBASE_URL}${path}`, { method, headers, body: payload });
}

/**
 * Parent-path type: alternating [plural, id, plural, id, ...] segments.
 */
export type ParentPath = string[];

function pathFor(plural: string, parent?: ParentPath): string {
  if (parent && parent.length > 0) return '/' + parent.join('/') + `/${plural}`;
  return `/${plural}`;
}

/**
 * List records, following `next_page_token` pagination.
 */
export async function aepList<T>(
  plural: string,
  token: string,
  parent?: ParentPath,
): Promise<T[]> {
  const base = pathFor(plural, parent);
  const out: T[] = [];
  let pageToken: string | undefined;
  do {
    const qs = new URLSearchParams();
    qs.set('max_page_size', '200');
    if (pageToken) qs.set('page_token', pageToken);
    const res = await aepbaseFetch(`${base}?${qs}`, { token });
    if (!res.ok) {
      throw new Error(`list ${base} → ${res.status}`);
    }
    const body = (await res.json()) as {
      results?: T[];
      next_page_token?: string;
    };
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
  const res = await aepbaseFetch(`${pathFor(plural, parent)}/${id}`, { token });
  if (!res.ok) throw new Error(`get ${plural}/${id} → ${res.status}`);
  return (await res.json()) as T;
}

export async function aepCreate<T>(
  plural: string,
  body: Record<string, unknown>,
  token: string,
  parent?: ParentPath,
): Promise<T> {
  const res = await aepbaseFetch(pathFor(plural, parent), {
    token,
    method: 'POST',
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`create ${plural} → ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function aepUpdate<T>(
  plural: string,
  id: string,
  body: Record<string, unknown>,
  token: string,
  parent?: ParentPath,
): Promise<T> {
  const res = await aepbaseFetch(`${pathFor(plural, parent)}/${id}`, {
    token,
    method: 'PATCH',
    body,
    mergePatch: true,
  });
  if (!res.ok) throw new Error(`update ${plural}/${id} → ${res.status}`);
  return (await res.json()) as T;
}

export async function aepRemove(
  plural: string,
  id: string,
  token: string,
  parent?: ParentPath,
): Promise<void> {
  const res = await aepbaseFetch(`${pathFor(plural, parent)}/${id}`, {
    token,
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`delete ${plural}/${id} → ${res.status}`);
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
