/**
 * Server-side permission surface.
 *
 * The pure resolver (`resolve`, `computeVisibility`, and all the types) lives in
 * `@rambleraptor/homestead-core/permissions/resolve` so the client and server
 * run the exact same code — this module simply re-exports it. Engine code keeps
 * importing from `./permissions`, so the indirection is transparent.
 *
 * Enforcement is unconditional: the engine always consults grants. There is no
 * off switch. The only gate is `PermissionStore.hasBaseline()` — a fail-open
 * safety valve for the boot window before the baseline seed lands (or a
 * fully-wiped household), never a user-facing toggle.
 */

export * from '@rambleraptor/homestead-core/permissions/resolve';
