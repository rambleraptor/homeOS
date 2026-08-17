/**
 * bcrypt hashing via bcryptjs (pure JS) so the exact same algorithm runs
 * under Bun and Node — Bun.password's bcrypt pre-hashes >72-byte passwords
 * with SHA-512, which would make such hashes runtime-specific. bcryptjs
 * emits `$2b$` and verifies the Go server's legacy `$2a$` rows.
 */

import bcrypt from 'bcryptjs';

// Go used bcrypt.DefaultCost (10); existing rows coexist with new hashes.
const BCRYPT_COST = 10;

/** Shortest password any write path will accept. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Longest password any write path will accept. bcrypt hashes at most 72 bytes
 * and silently ignores the rest, so a longer password would only *look* like it
 * carried more entropy — the tail would never be checked at login. Rejecting is
 * honest about the algorithm's limit rather than quietly truncating.
 */
export const MAX_PASSWORD_BYTES = 72;

/**
 * Outcome of a policy check. The `ok` branch carries the value back as a
 * `string` so a caller that started from an untrusted `unknown` body field can
 * hash it without a second cast.
 */
export type PasswordCheck = { ok: true; password: string } | { ok: false; error: string };

/**
 * The single password policy, applied on every path that sets a password:
 * `/api/setup`, `POST /users`, `PATCH /users`, and `/api/auth/change-password`.
 * Kept here next to the hashing so a new write path can't pick up one without
 * the other.
 */
export function validatePassword(password: unknown): PasswordCheck {
  if (typeof password !== 'string' || password === '') {
    return { ok: false, error: 'password is required' };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  // Measured in bytes, not characters: bcrypt's limit is on the encoded input,
  // so a multi-byte passphrase hits it sooner than its length suggests.
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    return { ok: false, error: `password must be at most ${MAX_PASSWORD_BYTES} bytes` };
  }
  if (password.trim() === '') {
    return { ok: false, error: 'password must not be entirely whitespace' };
  }
  return { ok: true, password };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash).catch(() => false);
}

/**
 * A real cost-10 hash of a fixed throwaway string. Nothing authenticates
 * against it — it exists only to give {@link verifyPasswordDummy} the same work
 * to do as a genuine verification. A constant (rather than a lazily-hashed one)
 * keeps the cost identical from the very first request, with no boot-time
 * bcrypt round.
 */
const DUMMY_HASH = '$2b$10$An8o.uVkA3mavU2sP7NAY.p3T8kxcTF3IMxojZUc1.YmOYjeyP.1K';

/**
 * Burn one bcrypt verification's worth of work and report failure. Call this on
 * a login attempt for an address with no account, so an unknown email costs the
 * same as a known one. Skipping it leaves a reliable account-enumeration
 * oracle: a wrong password takes ~100ms, a nonexistent user microseconds.
 */
export async function verifyPasswordDummy(password: string): Promise<false> {
  await verifyPassword(password, DUMMY_HASH);
  return false;
}
