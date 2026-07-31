/**
 * Permissions system (design: packages/homestead-site/docs/design/permissions.md).
 *
 * Phase 0 introduces only the kill-switch. The authoritative resolver,
 * PermissionStore, and LIST visibility predicate arrive in later phases; until
 * `PERMISSIONS_ENFORCED` is turned on, none of that machinery gates a request —
 * the engine behaves exactly as it did before.
 */

/**
 * Master switch for permission enforcement. Off by default so every phase can
 * merge dark: the `_owner` column and (later) the resolver can land and be
 * exercised without changing observable behavior. Flip to `'true'` to enforce.
 */
export function permissionsEnforced(): boolean {
  return process.env.PERMISSIONS_ENFORCED === 'true';
}
