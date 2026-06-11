/**
 * ID, token, and timestamp generation — kept bit-compatible with the Go
 * server so new rows interleave correctly with existing data:
 *  - IDs are hex-encoded nanosecond timestamps (Go: `%x` of UnixNano), which
 *    makes `ORDER BY id` insertion-ordered — pagination depends on this.
 *  - Tokens are 64-char random hex.
 *  - Timestamps are RFC3339 UTC with seconds precision (no millis).
 */

let lastNanos = 0n;

export function generateId(): string {
  // JS clocks are millisecond-resolution; scale to nanoseconds to match the
  // magnitude of Go-generated IDs and bump monotonically within the same ms.
  let nanos = BigInt(Date.now()) * 1_000_000n;
  if (nanos <= lastNanos) nanos = lastNanos + 1n;
  lastNanos = nanos;
  return nanos.toString(16);
}

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function nowRFC3339(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}
