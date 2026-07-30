/**
 * Error bodies follow RFC 9457 (Problem Details) so they carry the top-level
 * `type`/`status` fields AEP-193 requires, while retaining the legacy
 * `{ error: { code, message } }` envelope every existing consumer parses.
 */

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** HTTP reason phrases (RFC 9110) for the statuses the engine emits. */
const REASON_PHRASES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  500: 'Internal Server Error',
};

/** Throwable error carrying an HTTP status; routers map it to the envelope. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * An RFC 9457 problem-details body. `type` is `about:blank` — the RFC's default
 * sentinel for "no semantics beyond the HTTP status", which is a valid URI
 * reference (AEP-193 requires the `type` field to be one) — `title` is the HTTP
 * reason phrase, and `status` mirrors the HTTP code. The nested
 * `error: { code, message }` is kept for back-compat with existing clients.
 */
export function errorResponse(code: number, message: string): Response {
  const body = {
    type: 'about:blank',
    title: REASON_PHRASES[code] ?? 'Error',
    status: code,
    detail: message,
    error: { code, message },
  };
  return new Response(JSON.stringify(body), {
    status: code,
    headers: JSON_HEADERS,
  });
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function isUniqueConstraintError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('UNIQUE constraint failed') || msg.includes('unique constraint');
}
