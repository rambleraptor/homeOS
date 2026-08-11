/**
 * Server-side permission surface.
 *
 * The pure resolver (`resolve`, `computeVisibility`, and all the types) lives in
 * `@rambleraptor/homestead-core/permissions/resolve` so the client and server
 * run the exact same code — this module simply re-exports it. Engine code keeps
 * importing from `./permissions`, so the indirection is transparent.
 *
 * Enforcement is unconditional and fail-CLOSED: the engine always consults
 * grants, and a caller with no applicable grant falls back to their own rows
 * (never to open access). There is no off switch and no fail-open valve — a
 * missing/wiped baseline locks the household down rather than exposing it, with
 * the superuser (break-glass) able to recover. `PermissionStore.hasBaseline()`
 * survives only as an operational signal (a boot-window warning).
 */

export * from '@rambleraptor/homestead-core/permissions/resolve';
