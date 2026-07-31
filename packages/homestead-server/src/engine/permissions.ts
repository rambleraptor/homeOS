/**
 * Server-side permission surface.
 *
 * The pure resolver (`resolve`, `computeVisibility`, and all the types) lives in
 * `@rambleraptor/homestead-core/permissions/resolve` so the client and server
 * run the exact same code — this module re-exports it and adds the server-only
 * enforcement mode read from the environment. Engine code keeps importing from
 * `./permissions`, so the move is transparent.
 */

export * from '@rambleraptor/homestead-core/permissions/resolve';

/**
 * Master switch for permission enforcement, three-valued:
 *   - `off`    (default) — nothing changes; the engine uses the legacy
 *     `checkUserScope` path and never consults grants.
 *   - `shadow` — the resolver runs and logs what it *would* deny, but the
 *     request proceeds. For a safe rollout: watch real traffic before enforcing.
 *   - `on`     — denials are enforced (403 / filtered lists).
 *
 * Set via `PERMISSIONS_ENFORCED` = `true` | `on` | `shadow` (anything else off).
 */
export type PermissionMode = 'off' | 'shadow' | 'on';

export function permissionMode(): PermissionMode {
  const v = process.env.PERMISSIONS_ENFORCED;
  if (v === 'shadow') return 'shadow';
  if (v === 'true' || v === 'on') return 'on';
  return 'off';
}

/** True when the resolver should run (enforced or shadow). */
export function permissionsActive(): boolean {
  return permissionMode() !== 'off';
}
