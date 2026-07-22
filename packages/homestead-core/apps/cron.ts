/**
 * Cron hooks — periodic server-side work an app schedules.
 *
 * An app declares `crons: CronHook[]` on its {@link AppConfig}; the server's
 * scheduler (`packages/homestead-server/src/cron.ts`) starts a timer per hook
 * on boot and invokes the lazily-imported handler every `intervalSeconds`.
 *
 * Handlers run without a user request, so the scheduler mints a short-lived
 * admin bearer token per firing (like the boot-time schema sync) and hands it
 * to the handler on {@link CronContext.token}. Pair it with the server-side
 * aepbase helpers (`@rambleraptor/homestead-core/server/aepbase`) to read or
 * write engine data.
 *
 * The handler is referenced through a lazy `import()` — the same convention as
 * AEP-136 custom methods — so the server-only code stays out of the client
 * bundle. Keep handler modules under the app's `crons/` (or `methods/`)
 * directory, or name them `*.server.ts`, so the production build stubs them out
 * of the browser bundle (see `packages/homestead-app/vite.config.ts`).
 */

/**
 * Context passed to a cron handler each time the scheduler fires it.
 */
export interface CronContext {
  /** The firing hook's declared {@link CronHook.id}. */
  id: string;
  /** Id of the app that declared the hook. */
  appId: string;
  /**
   * Short-lived admin bearer token for engine access via the server-side
   * aepbase helpers. Minted for this firing and revoked once the handler
   * settles — don't retain it past the handler's lifetime.
   */
  token: string;
  /** RFC3339 timestamp of this firing. */
  firedAt: string;
}

/**
 * A cron handler. Runs to completion (or rejection); the scheduler logs and
 * swallows a rejection so one bad run can't take the process down, and skips
 * the next tick if a previous run of the same hook is still in flight.
 */
export type CronHandler = (ctx: CronContext) => Promise<void>;

/**
 * Declarative description of a single periodic hook an app schedules.
 */
export interface CronHook {
  /**
   * Stable id, unique across every app's hooks. Used to label log output and
   * to guard against overlapping runs. The registry drops a hook whose id
   * collides with one already seen.
   */
  id: string;

  /**
   * Seconds between firings. The scheduler runs the handler every
   * `intervalSeconds` seconds for as long as the server is up. Must be a
   * positive number; the registry drops a hook with a non-positive interval.
   */
  intervalSeconds: number;

  /**
   * Also run the handler once immediately at boot, in addition to the
   * recurring interval. Defaults to `false` (first run is one interval in).
   */
  runOnStart?: boolean;

  /**
   * Lazy import of the handler module. The scheduler awaits this on demand and
   * invokes the default export.
   */
  load: () => Promise<{ default: CronHandler }>;
}
