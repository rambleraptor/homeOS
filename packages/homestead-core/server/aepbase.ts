/**
 * Server-side aepbase helper.
 *
 * The browser wrapper at `core/api/aepbase` is tuned for client-side use
 * (localStorage, same-origin `/api/aep` proxy). Server code (the server's
 * API routes and app workers) needs to talk to the engine over the network
 * with the user's forwarded bearer token, so it uses this tiny helper
 * instead. It addresses the engine through the same `/api/aep` prefix the
 * browser uses — there is no separate engine port.
 *
 * Runtime-agnostic: takes a Web `Request`, so it works under Next, Bun,
 * and any Fetch-based server.
 */

/**
 * Base URL of the running engine, including the `/api/aep` prefix. The server
 * sets `AEPBASE_URL` at boot to `http://127.0.0.1:<port>/api/aep`; the default
 * here is the standalone fallback. Helper call sites pass bare engine paths
 * (`/users/me`, `/gift-cards`) that hang off this base.
 */
export const AEPBASE_URL =
  process.env.AEPBASE_URL || 'http://127.0.0.1:3000/api/aep';

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
 * Build an error suffix that includes aepbase's response body, not just the
 * status code. The chat tools surface these messages to the user, so the
 * actual reason (validation message, "not found", etc.) must survive.
 */
async function aepError(res: Response): Promise<string> {
  let detail = '';
  try {
    detail = (await res.text()).trim();
  } catch {
    // Body already consumed or unreadable — fall back to the status alone.
  }
  return detail ? `${res.status}: ${detail}` : `${res.status}`;
}

/**
 * List records, following `next_page_token` pagination.
 */
export async function aepList<T>(
  plural: string,
  token: string,
  parent?: ParentPath,
  filter?: string,
  orderBy?: string,
): Promise<T[]> {
  const base = pathFor(plural, parent);
  const out: T[] = [];
  let pageToken: string | undefined;
  do {
    const qs = new URLSearchParams();
    qs.set('max_page_size', '200');
    // URLSearchParams encodes the value (quotes/spaces in a filter expression).
    if (filter) qs.set('filter', filter);
    if (orderBy) qs.set('order_by', orderBy);
    if (pageToken) qs.set('page_token', pageToken);
    const res = await aepbaseFetch(`${base}?${qs}`, { token });
    if (!res.ok) {
      throw new Error(`list ${base} → ${await aepError(res)}`);
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
  if (!res.ok) throw new Error(`get ${plural}/${id} → ${await aepError(res)}`);
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
    throw new Error(`create ${plural} → ${await aepError(res)}`);
  }
  return (await res.json()) as T;
}

/**
 * Create a record that carries a file field, via a multipart upload — the
 * server-side equivalent of the SPA's `FormData` create (see
 * `documents/hooks/useUploadDocument.ts`). The engine's multipart parser
 * (`engine/crud.ts`) expects a JSON `resource` part plus a file part whose form
 * field name matches a declared file field.
 *
 * Uses a direct `fetch` rather than {@link aepbaseFetch}, which forces a JSON
 * content-type; here we must let `fetch` set the multipart boundary itself, so
 * only the Authorization header is sent.
 */
export async function aepCreateMultipart<T>(
  plural: string,
  fields: Record<string, unknown>,
  file: {
    /** Form field name; must match the resource's file field. Default `file`. */
    field?: string;
    filename: string;
    contentType: string;
    bytes: Buffer | Uint8Array;
  },
  token: string,
  parent?: ParentPath,
): Promise<T> {
  const form = new FormData();
  form.append('resource', JSON.stringify(fields));
  // Copy into a fresh ArrayBuffer-backed view: a Node Buffer's backing store is
  // typed as ArrayBufferLike (possibly SharedArrayBuffer), which BlobPart's
  // stricter DOM types reject.
  form.append(
    file.field ?? 'file',
    new Blob([Uint8Array.from(file.bytes)], { type: file.contentType }),
    file.filename,
  );
  const res = await fetch(`${AEPBASE_URL}${pathFor(plural, parent)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`create ${plural} (multipart) → ${await aepError(res)}`);
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
  if (!res.ok) throw new Error(`update ${plural}/${id} → ${await aepError(res)}`);
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
  if (!res.ok) throw new Error(`delete ${plural}/${id} → ${await aepError(res)}`);
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
