/**
 * Content hashing for uploaded files.
 *
 * Server-only (uses `node:crypto`) so it runs identically under Bun and Node,
 * and never reaches the browser bundle. Hashing on the server — rather than in
 * the SPA — avoids depending on `crypto.subtle`, which is absent when the app
 * is served over plain HTTP on a LAN (a common self-hosted deployment).
 */

import { createHash } from 'node:crypto';

/** Lowercase-hex SHA-256 of the given bytes. */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
