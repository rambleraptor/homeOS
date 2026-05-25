import { AepError } from './errors';
import type { TokenProvider } from './auth';

export interface TransportOptions {
  baseUrl: string;
  auth: TokenProvider;
  fetch?: typeof fetch;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Send the body as `application/merge-patch+json` (PATCH default). */
  mergePatch?: boolean;
  /** Bypass JSON parsing and return the raw `Response`. */
  raw?: boolean;
}

export class Transport {
  readonly baseUrl: string;
  private readonly auth: TokenProvider;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: TransportOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.auth = opts.auth;
    this.fetchImpl = opts.fetch ?? fetch;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, query, mergePatch, raw } = options;

    let url = `${this.baseUrl}${path}`;
    if (query) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== '') params.set(k, String(v));
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const headers: Record<string, string> = {};
    const token = await this.auth.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const init: RequestInit = { method, headers };
    if (body instanceof FormData) {
      init.body = body;
    } else if (body !== undefined) {
      headers['Content-Type'] = mergePatch
        ? 'application/merge-patch+json'
        : 'application/json';
      init.body = JSON.stringify(body);
    }

    const res = await this.fetchImpl(url, init);

    if (raw) {
      if (!res.ok) await throwAep(res, url);
      return res as unknown as T;
    }

    if (res.status === 204) return undefined as T;

    const text = await res.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        // not JSON; raw text surfaced via error path below
      }
    }

    if (!res.ok) {
      const envelope = parsed as
        | { error?: { code?: number; message?: string } }
        | undefined;
      const code = envelope?.error?.code ?? res.status;
      const message = envelope?.error?.message ?? text ?? `HTTP ${res.status}`;
      throw new AepError(code, message, url);
    }

    return parsed as T;
  }
}

async function throwAep(res: Response, url: string): Promise<never> {
  let message = `HTTP ${res.status}`;
  try {
    const envelope = (await res.json()) as { error?: { message?: string } };
    if (envelope?.error?.message) message = envelope.error.message;
  } catch {
    // not JSON
  }
  throw new AepError(res.status, message, url);
}
