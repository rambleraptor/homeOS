/** The `{error: {code, message}}` envelope every consumer parses. */

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Throwable error carrying an HTTP status; routers map it to the envelope. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(code: number, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
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
