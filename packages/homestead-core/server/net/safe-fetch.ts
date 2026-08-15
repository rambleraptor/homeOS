/**
 * Outbound fetch for user-supplied URLs.
 *
 * Homestead runs on a box inside a household LAN, so a URL a user pastes into
 * an import form is an SSRF primitive unless it's fenced: `http://192.168.1.1/`,
 * `http://169.254.169.254/`, and `http://localhost:<port>/api/aep` are all
 * reachable from the server and none of them are reachable from the user's
 * browser. Everything that fetches an address a *user* chose goes through here.
 *
 * The fence:
 *   - http/https only (no `file:`, `gopher:`, `data:`, …)
 *   - every hostname is resolved and every resolved address range-checked
 *     against loopback / private / link-local / ULA / CGNAT / reserved space
 *   - redirects are followed manually so each hop is re-validated — a public
 *     host that 302s to `10.0.0.5` doesn't get a free pass
 *   - no credentials: `Authorization` is never set and cookies are not stored
 *   - bounded time, bounded redirects, bounded body
 *
 * Known limitation: the runtime re-resolves the hostname when it connects, so
 * a DNS entry that changes between our check and the connect (DNS rebinding)
 * can slip past. Closing that needs connect-time pinning, which `fetch` does
 * not expose on either runtime this ships on. The residual risk is one request
 * to an internal address whose *response body* is still range-checked away
 * from the caller on redirect, and operators who want it gone entirely can
 * turn URL-sourced fetching off at the app level.
 */

import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

/** Thrown for every rejection, so callers can surface one clean message. */
export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

export interface SafeFetchOptions {
  /** Give up after this long, including redirects. */
  timeoutMs?: number;
  /** Hard cap on the decoded body. Exceeding it is an error, not a truncation. */
  maxBytes?: number;
  /** Redirect hops to follow before giving up. */
  maxRedirects?: number;
  /** Require the response's Content-Type to match one of these prefixes. */
  accept?: string[];
  /** Sent as the `Accept` header. Defaults to the `accept` list joined. */
  acceptHeader?: string;
}

const DEFAULTS = {
  timeoutMs: 10_000,
  maxBytes: 2 * 1024 * 1024,
  maxRedirects: 5,
} as const;

/**
 * Identify Homestead honestly rather than impersonating a browser. Sites that
 * would rather not be read by a tool get a name to block, and the contact URL
 * gives an operator somewhere to look when they see it in a log.
 */
const USER_AGENT =
  'Homestead/1.0 (+https://github.com/rambleraptor/homestead) recipe-import';

/** Parse and reject anything that isn't a plain http(s) URL. */
export function parseHttpUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new UnsafeUrlError(`Not a valid URL: ${input}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError(
      `Only http and https URLs can be imported (got ${url.protocol.replace(':', '')})`,
    );
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError('URLs with embedded credentials are not allowed');
  }
  return url;
}

/**
 * Whether `ip` is outside the ranges a household server must never be talked
 * into reaching on a user's behalf.
 *
 * Deliberately a denylist of non-public space rather than an allowlist of
 * public space: the reserved ranges are enumerable and stable, whereas "the
 * public internet" is not.
 */
export function isPublicAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPublicIPv4(ip);
  if (version === 6) return isPublicIPv6(ip);
  return false;
}

function isPublicIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return false;
  }
  const [a, b] = parts;

  if (a === 0) return false; // 0.0.0.0/8 "this network"
  if (a === 10) return false; // private
  if (a === 127) return false; // loopback
  if (a === 100 && b >= 64 && b <= 127) return false; // 100.64/10 CGNAT
  if (a === 169 && b === 254) return false; // link-local (incl. cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return false; // private
  if (a === 192 && b === 0) return false; // 192.0.0/24 + 192.0.2/24 (TEST-NET-1)
  if (a === 192 && b === 88) return false; // 6to4 relay anycast
  if (a === 192 && b === 168) return false; // private
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51) return false; // TEST-NET-2
  if (a === 203 && b === 0) return false; // TEST-NET-3
  if (a >= 224) return false; // multicast, reserved, broadcast

  return true;
}

function isPublicIPv6(ip: string): boolean {
  const addr = ip.toLowerCase().split('%')[0]; // drop any zone index

  if (addr === '::' || addr === '::1') return false; // unspecified / loopback

  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible forms defer to the v4 rules,
  // otherwise ::ffff:127.0.0.1 would sail through as "some IPv6 address".
  const mapped = addr.match(/^::(?:ffff:(?:0{1,4}:)?)?(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPublicIPv4(mapped[1]);

  // NAT64 well-known prefix 64:ff9b::/96 wraps a v4 address in its low 32 bits.
  if (addr.startsWith('64:ff9b:')) return false;

  const head = addr.split(':')[0];
  const group = parseInt(head || '0', 16);

  if ((group & 0xfe00) === 0xfc00) return false; // fc00::/7 unique-local
  if ((group & 0xffc0) === 0xfe80) return false; // fe80::/10 link-local
  if (group === 0xff00 || (group & 0xff00) === 0xff00) return false; // ff00::/8 multicast
  if (addr.startsWith('2001:db8:')) return false; // documentation
  if (addr.startsWith('2002:')) return false; // 6to4

  return true;
}

/**
 * Resolve `hostname` and assert every address it answers with is public.
 *
 * Every address, not just the first: a name that resolves to both a public and
 * a private address must not be usable to reach the private one.
 */
async function assertHostIsPublic(hostname: string): Promise<void> {
  // A literal in the URL needs no resolution — check it directly.
  if (isIP(hostname)) {
    if (!isPublicAddress(hostname)) {
      throw new UnsafeUrlError(`Refusing to fetch a non-public address (${hostname})`);
    }
    return;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new UnsafeUrlError(`Could not resolve ${hostname}`);
  }
  if (addresses.length === 0) {
    throw new UnsafeUrlError(`Could not resolve ${hostname}`);
  }
  for (const { address } of addresses) {
    if (!isPublicAddress(address)) {
      throw new UnsafeUrlError(
        `Refusing to fetch ${hostname} — it resolves to a non-public address (${address})`,
      );
    }
  }
}

/** Read a response body, aborting past `maxBytes` instead of buffering it all. */
async function readCapped(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length') ?? NaN);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new UnsafeUrlError(`Response is larger than ${maxBytes} bytes`);
  }

  const body = response.body;
  if (!body) return new Uint8Array(0);

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        throw new UnsafeUrlError(`Response is larger than ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export interface SafeFetchResponse {
  /** The URL the body actually came from, after redirects. */
  url: string;
  status: number;
  contentType: string;
  bytes: Uint8Array;
}

/**
 * Fetch a user-supplied URL under the fence described at the top of this file.
 *
 * Throws {@link UnsafeUrlError} for anything the fence rejects, so a caller can
 * turn it straight into a user-facing message without leaking a stack.
 */
export async function safeFetch(
  input: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResponse> {
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const maxBytes = options.maxBytes ?? DEFAULTS.maxBytes;
  const maxRedirects = options.maxRedirects ?? DEFAULTS.maxRedirects;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let url = parseHttpUrl(input);

    for (let hop = 0; hop <= maxRedirects; hop++) {
      await assertHostIsPublic(url.hostname);

      let response: Response;
      try {
        response = await fetch(url, {
          // Manual, so each hop goes back through assertHostIsPublic above.
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'User-Agent': USER_AGENT,
            Accept: options.acceptHeader ?? options.accept?.join(', ') ?? '*/*',
            'Accept-Language': 'en',
          },
        });
      } catch (error) {
        if (controller.signal.aborted) {
          throw new UnsafeUrlError(`Timed out after ${timeoutMs}ms fetching ${url.hostname}`);
        }
        throw new UnsafeUrlError(
          `Could not reach ${url.hostname}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        await response.body?.cancel().catch(() => {});
        if (!location) {
          throw new UnsafeUrlError(`${url.hostname} sent a redirect with no location`);
        }
        if (hop === maxRedirects) {
          throw new UnsafeUrlError(`Too many redirects (more than ${maxRedirects})`);
        }
        url = parseHttpUrl(new URL(location, url).toString());
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw new UnsafeUrlError(`${url.hostname} returned HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (options.accept && options.accept.length > 0) {
        const base = contentType.split(';')[0].trim().toLowerCase();
        const ok = options.accept.some((prefix) => base.startsWith(prefix.toLowerCase()));
        if (!ok) {
          await response.body?.cancel().catch(() => {});
          throw new UnsafeUrlError(
            `Expected ${options.accept.join(' or ')} but ${url.hostname} returned ${base || 'no content type'}`,
          );
        }
      }

      return {
        url: url.toString(),
        status: response.status,
        contentType,
        bytes: await readCapped(response, maxBytes),
      };
    }

    throw new UnsafeUrlError(`Too many redirects (more than ${maxRedirects})`);
  } finally {
    clearTimeout(timer);
  }
}

/** Convenience wrapper for the HTML case: enforces a text/html content type. */
export async function safeFetchHtml(
  input: string,
  options: SafeFetchOptions = {},
): Promise<{ url: string; html: string }> {
  const response = await safeFetch(input, {
    accept: ['text/html', 'application/xhtml+xml'],
    acceptHeader: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    ...options,
  });
  return {
    url: response.url,
    html: new TextDecoder('utf-8').decode(response.bytes),
  };
}
