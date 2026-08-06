/**
 * Cloudflare Access JWT verification.
 *
 * A test RSA keypair stands in for the team's signing key: we sign JWTs with the
 * private half and serve the public half as the JWKS (via the `fetchCerts` test
 * seam), then assert the verifier accepts a well-formed token and rejects every
 * way one can be malformed — wrong audience, wrong issuer, expired, or tampered.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  makeAccessJwtVerifier,
  ACCESS_JWT_HEADER,
  __clearAccessJwksCacheForTests,
} from '../../src/auth/access-jwt';

const TEAM = 'acme';
const ISSUER = 'https://acme.cloudflareaccess.com';
const AUD = 'aud-tag-deadbeef';
const KID = 'test-kid-1';
const NOW_MS = 1_700_000_000_000; // fixed clock for deterministic exp checks
const NOW_S = Math.floor(NOW_MS / 1000);

function b64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlJson(value: unknown): string {
  return b64url(new TextEncoder().encode(JSON.stringify(value)));
}

async function makeKeypair() {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const jwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey & {
    kid?: string;
  };
  jwk.kid = KID;
  return { privateKey: pair.privateKey, jwk };
}

async function signJwt(
  privateKey: CryptoKey,
  payload: Record<string, unknown>,
  header: Record<string, unknown> = { alg: 'RS256', kid: KID, typ: 'JWT' },
): Promise<string> {
  const signingInput = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new Uint8Array(new TextEncoder().encode(signingInput)),
  );
  return `${signingInput}.${b64url(new Uint8Array(sig))}`;
}

function reqWith(token: string): Request {
  return new Request('https://home.example.com/api/mcp', {
    method: 'POST',
    headers: { [ACCESS_JWT_HEADER]: token },
  });
}

describe('makeAccessJwtVerifier', () => {
  let privateKey: CryptoKey;
  let jwk: JsonWebKey;
  let verify: (req: Request) => Promise<{ email: string; sub?: string } | null>;
  let fetchCount: number;

  const validPayload = () => ({
    iss: ISSUER,
    aud: AUD,
    email: 'user@example.com',
    sub: 'sub-123',
    exp: NOW_S + 600,
    iat: NOW_S - 10,
  });

  beforeEach(async () => {
    __clearAccessJwksCacheForTests();
    ({ privateKey, jwk } = await makeKeypair());
    fetchCount = 0;
    verify = makeAccessJwtVerifier({
      teamDomain: TEAM,
      aud: AUD,
      now: () => NOW_MS,
      fetchCerts: async () => {
        fetchCount++;
        return { keys: [jwk] };
      },
    });
  });

  it('accepts a well-formed token and returns the identity', async () => {
    const token = await signJwt(privateKey, validPayload());
    expect(await verify(reqWith(token))).toEqual({ email: 'user@example.com', sub: 'sub-123' });
  });

  it('returns null when the header is absent', async () => {
    const bare = new Request('https://home.example.com/api/mcp', { method: 'POST' });
    expect(await verify(bare)).toBeNull();
  });

  it('rejects a token for the wrong audience', async () => {
    const token = await signJwt(privateKey, { ...validPayload(), aud: 'someone-elses-aud' });
    expect(await verify(reqWith(token))).toBeNull();
  });

  it('rejects a token from the wrong issuer', async () => {
    const token = await signJwt(privateKey, { ...validPayload(), iss: 'https://evil.example.com' });
    expect(await verify(reqWith(token))).toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await signJwt(privateKey, { ...validPayload(), exp: NOW_S - 3600 });
    expect(await verify(reqWith(token))).toBeNull();
  });

  it('rejects a token with no email claim', async () => {
    const p = validPayload();
    delete (p as Record<string, unknown>).email;
    const token = await signJwt(privateKey, p);
    expect(await verify(reqWith(token))).toBeNull();
  });

  it('rejects a token signed by a different key', async () => {
    const other = await makeKeypair();
    const token = await signJwt(other.privateKey, validPayload()); // header still claims KID
    expect(await verify(reqWith(token))).toBeNull();
  });

  it('rejects a tampered payload', async () => {
    const token = await signJwt(privateKey, validPayload());
    const [h, , s] = token.split('.');
    const forged = `${h}.${b64urlJson({ ...validPayload(), email: 'admin@example.com' })}.${s}`;
    expect(await verify(reqWith(forged))).toBeNull();
  });

  it('accepts a token whose aud is an array containing the configured tag', async () => {
    const token = await signJwt(privateKey, { ...validPayload(), aud: ['other', AUD] });
    expect(await verify(reqWith(token))).not.toBeNull();
  });

  it('accepts either aud when configured with multiple (origin + portal)', async () => {
    const PORTAL_AUD = 'portal-aud-cafef00d';
    const multi = makeAccessJwtVerifier({
      teamDomain: TEAM,
      aud: [AUD, PORTAL_AUD],
      now: () => NOW_MS,
      fetchCerts: async () => ({ keys: [jwk] }),
    });
    const originToken = await signJwt(privateKey, { ...validPayload(), aud: AUD });
    const portalToken = await signJwt(privateKey, { ...validPayload(), aud: PORTAL_AUD });
    expect(await multi(reqWith(originToken))).not.toBeNull();
    expect(await multi(reqWith(portalToken))).not.toBeNull();
    // A tag in neither list is still rejected.
    const strayToken = await signJwt(privateKey, { ...validPayload(), aud: 'stray-aud' });
    expect(await multi(reqWith(strayToken))).toBeNull();
  });

  it('caches the JWKS across verifications', async () => {
    const token = await signJwt(privateKey, validPayload());
    await verify(reqWith(token));
    await verify(reqWith(token));
    expect(fetchCount).toBe(1);
  });
});
