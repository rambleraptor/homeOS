/**
 * Reference-counting for short-lived admin bearer tokens.
 *
 * Background operations (the classify custom method, file indexing) run
 * detached from whatever triggered them: the trigger creates an `operation`
 * record and hands the work to the shared `operationRunner`, which may queue it
 * behind other work and run it much later. Each such operation makes several
 * loopback writes with the caller's token — promote-to-running, append logs,
 * mark done.
 *
 * That is fine when the caller's token is long-lived (a logged-in user). It is
 * *not* fine for the short-lived admin token a cron firing mints and revokes:
 * the `documents-ingest-email` cron fires classify/index operations
 * fire-and-forget, then revokes its token the instant the handler returns —
 * before those queued operations get to run. Their lifecycle writes then 401
 * and the records are stranded `pending`/`running` forever.
 *
 * This module lets a minted token be *leased*: registered with one reference
 * (the minter's own), retained by each operation created under it, and released
 * as each settles. The underlying token is only actually revoked once the last
 * reference is released — so the minter can "revoke" eagerly while any detached
 * operation it kicked off is still in flight, and the real deletion waits until
 * that work is done.
 *
 * Tokens that were never registered (ordinary user tokens) are unaffected:
 * `retain`/`release` are no-ops for them, so non-cron callers keep their
 * existing behavior.
 *
 * Runtime-agnostic: a plain in-process map keyed by token string, with no db or
 * server dependency (the actual deletion is supplied as a callback at lease
 * time). The registry is a module singleton, matching the single-process model
 * the whole server runs under.
 */

interface Lease {
  /** Outstanding references: the minter's own plus one per in-flight operation. */
  count: number;
  /** Deferred revocation — runs exactly once, when the last reference drops. */
  revoke: () => void;
}

const leases = new Map<string, Lease>();

/**
 * Register `token` as leased, holding one initial reference on behalf of the
 * minter. `revoke` (the real deletion, e.g. removing the token row from the db)
 * runs once the reference count returns to zero — never before. Idempotent per
 * token: re-registering the same live token is ignored so a stray double-mint
 * can't drop the reference count below the outstanding work.
 */
export function leaseToken(token: string, revoke: () => void): void {
  if (leases.has(token)) return;
  leases.set(token, { count: 1, revoke });
}

/**
 * Take a reference on a leased token for the lifetime of one operation. A no-op
 * for a token that was never leased (an ordinary user token), so it's safe to
 * call unconditionally from the shared operation lifecycle.
 */
export function retainToken(token: string): void {
  const lease = leases.get(token);
  if (lease) lease.count += 1;
}

/**
 * Release a reference previously taken with {@link retainToken}, or the minter's
 * own initial reference (from the token's `revoke()`). When the last reference
 * is released the token is dropped from the registry and its deferred `revoke`
 * runs. A no-op for an unleased or already-released token.
 */
export function releaseToken(token: string): void {
  const lease = leases.get(token);
  if (!lease) return;
  lease.count -= 1;
  if (lease.count <= 0) {
    leases.delete(token);
    lease.revoke();
  }
}

/** Test/introspection helper: current outstanding references, or 0 if unleased. */
export function leaseCount(token: string): number {
  return leases.get(token)?.count ?? 0;
}
