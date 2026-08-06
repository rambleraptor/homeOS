/**
 * Cloudflare Access JWT verification for the MCP endpoint.
 *
 * When Cloudflare Access sits in front of `/api/mcp` (the "MCP server behind
 * Access" model), Access authenticates the caller and forwards a signed JWT to
 * the origin in the `Cf-Access-Jwt-Assertion` header. This module verifies that
 * JWT — RS256 signature against the team's published JWKS, plus `iss`/`aud`/
 * `exp` — and returns the caller's identity (their email). The MCP route maps
 * that email to a Homestead user and runs the tools as them.
 *
 * A forged header can't pass: the token must be signed by the team's private
 * key and carry the configured application audience, so an attacker who reaches
 * the origin directly (bypassing Access) cannot mint a valid assertion.
 *
 * No JWT library is used — verification goes through Web Crypto (`crypto.subtle`,
 * a web standard present under both Bun and Node), so this stays within the
 * runtime seams the rest of the server observes.
 */

import type { CloudflareAccessConfig } from '@rambleraptor/homestead-core/apps/config';

/** The header Cloudflare Access injects at the origin, carrying the signed JWT. */
export const ACCESS_JWT_HEADER = 'Cf-Access-Jwt-Assertion';

/** The identity extracted from a verified Access JWT. */
export interface AccessIdentity {
  /** The authenticated user's email (the `email` claim). */
  email: string;
  /** The Access subject id (the `sub` claim), when present. */
  sub?: string;
}

/** A JWKS RSA key, carrying the `kid` the lib's `JsonWebKey` type omits. */
type Jwk = JsonWebKey & { kid?: string };

/** A minimal JWKS document (only the RSA public keys are used). */
interface Jwks {
  keys: Jwk[];
}

/** Encode a string as UTF-8 bytes backed by a plain ArrayBuffer (for `crypto.subtle`). */
function utf8(input: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new TextEncoder().encode(input));
}

/** Options for {@link makeAccessJwtVerifier} — the last two are test seams. */
export interface AccessJwtOptions extends CloudflareAccessConfig {
  /** Fetch the team's JWKS. Injected in tests; defaults to a real fetch. */
  fetchCerts?: (certsUrl: string) => Promise<Jwks>;
  /** Current time in ms. Injected in tests; defaults to `Date.now`. */
  now?: () => number;
}

/** Small clock skew (seconds) allowed when checking `exp`/`nbf`. */
const CLOCK_SKEW_SECONDS = 60;
/** How long a fetched JWKS is reused before a refetch (ms). */
const JWKS_TTL_MS = 10 * 60 * 1000;

interface CachedJwks {
  keys: Map<string, Jwk>;
  fetchedAt: number;
}

/** Process-wide JWKS cache, keyed by certs URL. */
const jwksCache = new Map<string, CachedJwks>();

/** Normalize a configured team domain to its issuer origin. */
function issuerFor(teamDomain: string): string {
  const trimmed = teamDomain.trim().replace(/\/+$/, '');
  if (/^https?:\/\//.test(trimmed)) return trimmed.replace(/^http:/, 'https:');
  // Accept either a bare team name ("acme") or a full host ("acme.cloudflareaccess.com").
  const host = trimmed.includes('.') ? trimmed : `${trimmed}.cloudflareaccess.com`;
  return `https://${host}`;
}

/** base64url → bytes. `atob` is a global under both Bun and Node. */
function base64UrlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlToString(input: string): string {
  return new TextDecoder().decode(base64UrlToBytes(input));
}

interface JwtHeader {
  alg?: string;
  kid?: string;
  typ?: string;
}

interface JwtPayload {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  email?: string;
  sub?: string;
}

interface ParsedJwt {
  header: JwtHeader;
  payload: JwtPayload;
  /** The `header.payload` bytes the signature covers. */
  signingInput: Uint8Array<ArrayBuffer>;
  signature: Uint8Array<ArrayBuffer>;
}

/** Split and decode a compact JWS. Returns null on any structural problem. */
function parseJwt(token: string): ParsedJwt | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;
  try {
    const header = JSON.parse(base64UrlToString(headerB64)) as JwtHeader;
    const payload = JSON.parse(base64UrlToString(payloadB64)) as JwtPayload;
    return {
      header,
      payload,
      signingInput: utf8(`${headerB64}.${payloadB64}`),
      signature: base64UrlToBytes(signatureB64),
    };
  } catch {
    return null;
  }
}

/** Fetch (or reuse a cached) map of `kid` → RSA public JWK for a certs URL. */
async function loadKeys(
  certsUrl: string,
  fetchCerts: (certsUrl: string) => Promise<Jwks>,
  now: () => number,
  forceRefresh: boolean,
): Promise<Map<string, Jwk>> {
  const cached = jwksCache.get(certsUrl);
  if (!forceRefresh && cached && now() - cached.fetchedAt < JWKS_TTL_MS) {
    return cached.keys;
  }
  const jwks = await fetchCerts(certsUrl);
  const keys = new Map<string, Jwk>();
  for (const key of jwks.keys ?? []) {
    if (key.kid) keys.set(key.kid, key);
  }
  jwksCache.set(certsUrl, { keys, fetchedAt: now() });
  return keys;
}

async function fetchCertsDefault(certsUrl: string): Promise<Jwks> {
  const res = await fetch(certsUrl, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Access certs fetch failed: ${res.status}`);
  return (await res.json()) as Jwks;
}

/** Import a JWKS RSA key for RS256 verification, discarding conflicting fields. */
async function importRsaKey(jwk: Jwk): Promise<CryptoKey> {
  const clean: JsonWebKey = { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true };
  return crypto.subtle.importKey(
    'jwk',
    clean,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

/**
 * Build a verifier for the given Cloudflare Access application. The returned
 * function reads the `Cf-Access-Jwt-Assertion` header off a request, verifies
 * it, and resolves to the caller's {@link AccessIdentity} — or `null` if the
 * header is absent or the token fails any check. It never throws for an invalid
 * token; a network failure fetching the JWKS is the only surfaced error.
 */
export function makeAccessJwtVerifier(
  opts: AccessJwtOptions,
): (req: Request) => Promise<AccessIdentity | null> {
  const issuer = issuerFor(opts.teamDomain);
  const certsUrl = `${issuer}/cdn-cgi/access/certs`;
  const audiences = new Set(Array.isArray(opts.aud) ? opts.aud : [opts.aud]);
  const fetchCerts = opts.fetchCerts ?? fetchCertsDefault;
  const now = opts.now ?? Date.now;

  return async function verify(req: Request): Promise<AccessIdentity | null> {
    const token = req.headers.get(ACCESS_JWT_HEADER);
    if (!token) return null;

    const parsed = parseJwt(token);
    if (!parsed) return null;
    const { header, payload, signingInput, signature } = parsed;

    // Claims are cheap to check and gate the (async) crypto work.
    if (header.alg !== 'RS256' || !header.kid) return null;
    if (payload.iss !== issuer) return null;
    const auds = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
    if (!auds.some((a) => audiences.has(a))) return null;
    const nowSeconds = now() / 1000;
    if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW_SECONDS < nowSeconds) {
      return null;
    }
    if (typeof payload.nbf === 'number' && payload.nbf - CLOCK_SKEW_SECONDS > nowSeconds) {
      return null;
    }
    if (!payload.email) return null;

    // Verify the signature, refetching the JWKS once if the kid is unknown
    // (Access rotates keys, so a fresh kid is expected, not an attack).
    let keys = await loadKeys(certsUrl, fetchCerts, now, false);
    let jwk = keys.get(header.kid);
    if (!jwk) {
      keys = await loadKeys(certsUrl, fetchCerts, now, true);
      jwk = keys.get(header.kid);
    }
    if (!jwk) return null;

    let ok: boolean;
    try {
      const key = await importRsaKey(jwk);
      ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signingInput);
    } catch {
      return null;
    }
    if (!ok) return null;

    return { email: payload.email, sub: payload.sub };
  };
}

/** Test-only: drop the cached JWKS so a test starts from a clean fetch. */
export function __clearAccessJwksCacheForTests(): void {
  jwksCache.clear();
}
