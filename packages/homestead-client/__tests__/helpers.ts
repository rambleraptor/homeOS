/**
 * A recording fetch double. Each call is captured; the handler decides the
 * response. Keeps tests transport-only — no real network, no real server.
 */

export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface MockResponse {
  status?: number;
  /** JSON body (stringified for the response). */
  json?: unknown;
  /** Raw text body (wins over `json`). */
  text?: string;
}

type Handler = (call: RecordedCall) => MockResponse;

export interface FetchMock {
  fetch: typeof fetch;
  calls: RecordedCall[];
}

/** Build a fetch mock whose `handler` maps each recorded call to a response. */
export function mockFetch(handler: Handler): FetchMock {
  const calls: RecordedCall[] = [];
  const fetchImpl = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = String(input);
    const headers = normalizeHeaders(init?.headers);
    const call: RecordedCall = {
      url,
      method: init?.method ?? 'GET',
      headers,
      body: init?.body,
    };
    calls.push(call);
    const out = handler(call);
    const status = out.status ?? 200;
    if (status === 204) return new Response(null, { status });
    const payload = out.text ?? (out.json !== undefined ? JSON.stringify(out.json) : '');
    return new Response(payload, {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch: fetchImpl as unknown as typeof fetch, calls };
}

function normalizeHeaders(h: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  if (h instanceof Headers) {
    h.forEach((v, k) => (out[k] = v));
  } else if (Array.isArray(h)) {
    for (const [k, v] of h) out[k] = v;
  } else {
    Object.assign(out, h);
  }
  return out;
}

/** Parse a recorded JSON body back to an object. */
export function jsonBody(call: RecordedCall): unknown {
  return typeof call.body === 'string' ? JSON.parse(call.body) : call.body;
}
