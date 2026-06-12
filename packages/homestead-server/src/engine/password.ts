/**
 * bcrypt hashing via bcryptjs (pure JS) so the exact same algorithm runs
 * under Bun and Node — Bun.password's bcrypt pre-hashes >72-byte passwords
 * with SHA-512, which would make such hashes runtime-specific. bcryptjs
 * emits `$2b$` and verifies the Go server's legacy `$2a$` rows.
 */

import bcrypt from 'bcryptjs';

// Go used bcrypt.DefaultCost (10); existing rows coexist with new hashes.
const BCRYPT_COST = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash).catch(() => false);
}
