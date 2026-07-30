/**
 * PKCE (RFC 7636) — S256 only, which OAuth 2.1 / the MCP auth spec require.
 * Pure and unit-testable; uses the global Web Crypto `crypto.subtle`, so it
 * runs unchanged under Bun and Node.
 */

function base64UrlEncode(bytes: ArrayBuffer): string {
  const b = new Uint8Array(bytes);
  let s = '';
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** SHA-256 base64url of the verifier — the expected `code_challenge` (S256). */
export async function s256Challenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(digest);
}

/** True when `verifier` hashes (S256) to the stored `challenge`. */
export async function verifyChallenge(verifier: string, challenge: string): Promise<boolean> {
  if (!verifier || !challenge) return false;
  return (await s256Challenge(verifier)) === challenge;
}
