/**
 * Data migrations — one-shot server-side transforms of existing records.
 *
 * The boot-time schema sync (`packages/homestead-server/src/schema-sync.ts`)
 * reconciles resource *definitions* — it creates, patches, or no-ops the
 * *shape* of each collection. It deliberately never touches *data*. Data
 * migrations fill that gap: backfilling a newly-added field, rewriting an
 * enum value, splitting one field into two, or correcting rows a bug wrote
 * badly.
 *
 * An app declares `migrations: Migration[]` on its {@link AppConfig}. On boot,
 * after the schema sync has applied every resource definition, the server's
 * migration runner (`packages/homestead-server/src/migrations.ts`) runs each
 * pending migration exactly once and records the outcome in a ledger, so a
 * migration that has already succeeded is skipped on every subsequent boot.
 *
 * Migrations mirror {@link CronHook}s in every structural way — a stable id, an
 * optional title, and a lazily-imported handler — so there's nothing new to
 * learn. The one difference is lifecycle: a cron fires on an interval forever;
 * a migration runs once and is remembered.
 *
 * Handlers run headless (no user request), so the runner mints a short-lived
 * admin bearer token and hands it to the handler on {@link MigrationContext.token}.
 * Pair it with the shared client (`serverClient(token)` from
 * `@rambleraptor/homestead-core/server/client`) to read and rewrite engine
 * data — going through the engine keeps references, file fields, validation,
 * and `update_time` intact, which raw SQL would bypass.
 *
 * The handler is referenced through a lazy `import()` — the same convention as
 * cron handlers and AEP-136 custom methods — so the server-only code stays out
 * of the client bundle. Keep handler modules under the app's `migrations/`
 * directory (or name them `*.server.ts`) so the production build stubs them out
 * of the browser bundle (see `packages/homestead-app/vite.config.ts`).
 */

/**
 * Context passed to a migration handler when the runner invokes it.
 */
export interface MigrationContext {
  /** The migration's declared {@link Migration.id}. */
  id: string;
  /** Id of the app that declared the migration. */
  appId: string;
  /**
   * Short-lived admin bearer token for engine access via the server-side
   * aepbase helpers. Minted for this run and revoked once the whole migration
   * pass settles — don't retain it past the handler's lifetime.
   */
  token: string;
  /**
   * Append a progress line to this migration's ledger entry, surfaced in its
   * recorded `logs`. Never throws — a logging failure is swallowed — and is
   * safe to `await` (for ordering) or ignore. The runner brackets each run with
   * a terminal succeeded/failed status automatically; use this for the steps in
   * between (e.g. `await log('patched 50 of 200')`).
   */
  log: (message: string) => Promise<void>;
}

/**
 * A migration handler. Runs to completion (or rejection) exactly once across
 * the lifetime of an instance, then the runner records the outcome so it's
 * never re-run after success.
 *
 * **Write handlers to be idempotent anyway.** A migration that crashed
 * partway, or whose process died before the ledger recorded success, re-runs on
 * the next boot — so guard each record (skip rows already in the target shape)
 * rather than assuming a clean slate. Idempotence is belt-and-suspenders here:
 * the ledger prevents re-running a *succeeded* migration, and the guard makes a
 * *resumed* one safe.
 *
 * The resolved value is recorded as the migration's `result` (return a small
 * summary — e.g. `{ scanned: 200, patched: 12 }` — for a useful ledger entry),
 * and a thrown value becomes its `error`. Returning nothing is fine.
 */
export type MigrationHandler = (
  ctx: MigrationContext,
) => Promise<Record<string, unknown> | void>;

/**
 * Declarative description of a single data migration an app ships.
 */
export interface Migration {
  /**
   * Stable id, unique across every app's migrations. It is the ledger key — the
   * runner remembers a migration by this id, so **never reuse or rename one**
   * after it has shipped, or an already-applied migration will run again (or a
   * changed one will be skipped). Prefer a descriptive, app-prefixed slug, e.g.
   * `gift-cards-backfill-status`. The registry drops a migration whose id
   * collides with one already seen.
   */
  id: string;

  /**
   * Human-readable label for the migration, recorded in the ledger and log
   * output (e.g. `'Backfill gift-card status from balance'`). Defaults to the
   * migration's {@link id}.
   */
  title?: string;

  /**
   * Marks a migration that deletes or destructively rewrites data (as opposed
   * to a purely additive backfill). Recorded in the ledger for visibility.
   * Reserved for future gating — a follow-up `homestead migrate` command can
   * require an explicit opt-in before running destructive migrations, rather
   * than letting them run unattended at boot. Defaults to `false`. Declaring
   * {@link drops} implies destructive (the ledger records it as such).
   */
  destructive?: boolean;

  /**
   * Column drops this migration authorizes the boot-time schema sync to
   * perform. Removing a field from a resource definition drops its column, and
   * the engine refuses to drop a **populated** column unless it's listed here —
   * so an accidental field deletion (or a rename with no data migration) can't
   * silently destroy data. List a column here alongside the handler that has
   * already moved its data elsewhere (typically after a release in which the
   * field was {@link FieldDef.deprecated}). Each entry names the resource by its
   * kebab-case `singular` and the snake_case field being dropped. Implies
   * {@link destructive}.
   *
   * @example
   *   drops: [{ resource: 'gift-card', field: 'legacy_code' }]
   */
  drops?: Array<{ resource: string; field: string }>;

  /**
   * Lazy import of the handler module. The runner awaits this on demand and
   * invokes the default export.
   */
  load: () => Promise<{ default: MigrationHandler }>;
}
