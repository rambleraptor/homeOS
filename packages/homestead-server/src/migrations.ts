/**
 * Boot-time data-migration runner.
 *
 * The schema sync (`schema-sync.ts`) reconciles resource *definitions*; this
 * reconciles *data*. It applies each app-declared {@link RegisteredMigration}
 * exactly once, in declaration order, recording every attempt in a small
 * ledger table so a migration that has already succeeded is skipped forever
 * after.
 *
 * The ledger is a plain SQLite table (`_homestead_migrations`), not an aepbase
 * resource: it's infrastructure the operator never edits, so it stays out of
 * the user-facing resource space. This is the mirror of how cron works — the
 * declarative types live in core (`@rambleraptor/homestead-core/apps/migrations`)
 * while the runner that owns the database lives here in the server.
 *
 * Handlers reach the engine through the server-side aepbase helpers using the
 * short-lived admin token minted by the caller (the same token the schema sync
 * already holds), so a migration mutates data through the same validated,
 * reference-aware path the rest of the app uses.
 */

import type { Database } from './engine/sqlite';
import type { RegisteredMigration } from '@rambleraptor/homestead-core/apps/registry';
import type { MigrationContext } from '@rambleraptor/homestead-core/apps/migrations';
import { nowRFC3339 } from './engine/ids';

const LEDGER_TABLE = '_homestead_migrations';

/** Terminal or in-progress state of a ledger row. */
type LedgerStatus = 'running' | 'succeeded' | 'failed';

interface LedgerRow {
  migration_id: string;
  status: LedgerStatus;
}

export interface RunMigrationsOptions {
  /** Short-lived admin bearer token handed to each handler. */
  token: string;
  /** Aggregated migrations from apps, in declaration order. */
  migrations: RegisteredMigration[];
  /** Optional logger; defaults to console. */
  logger?: Pick<Console, 'info' | 'warn' | 'error'>;
}

export interface RunMigrationsResult {
  /** Ids of migrations whose handler ran and succeeded this pass. */
  ran: string[];
  /** Ids skipped because the ledger already records them as succeeded. */
  skipped: string[];
  /** Ids whose handler threw this pass (recorded, not fatal). */
  failed: string[];
}

/**
 * Apply every pending migration once. A migration is *pending* unless the
 * ledger already records it as `succeeded`; a previously `failed` or
 * interrupted `running` row is retried (handlers are written idempotent, so a
 * resumed run is safe). A handler that throws is recorded as `failed` and does
 * not stop the remaining migrations — they touch independent data.
 */
export async function runMigrations(
  db: Database,
  { token, migrations, logger = console }: RunMigrationsOptions,
): Promise<RunMigrationsResult> {
  ensureLedgerTable(db);
  const ledger = loadLedger(db);

  const result: RunMigrationsResult = { ran: [], skipped: [], failed: [] };

  for (const migration of migrations) {
    if (ledger.get(migration.id)?.status === 'succeeded') {
      result.skipped.push(migration.id);
      continue;
    }

    const title = migration.title ?? migration.id;
    const logs: string[] = [];
    const ctx: MigrationContext = {
      id: migration.id,
      appId: migration.appId,
      token,
      log: async (message: string) => {
        logs.push(message);
        logger.info(`[migration:${migration.id}] ${message}`);
      },
    };

    markRunning(db, migration);
    logger.info(`[migrations] running "${migration.id}" (${title})`);
    try {
      const mod = await migration.load();
      const value = await mod.default(ctx);
      const summary = (value ?? {}) as Record<string, unknown>;
      markSucceeded(db, migration.id, summary, logs);
      result.ran.push(migration.id);
      logger.info(
        `[migrations] "${migration.id}" succeeded: ${JSON.stringify(summary)}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      markFailed(db, migration.id, message, logs);
      result.failed.push(migration.id);
      logger.error(`[migrations] "${migration.id}" failed: ${message}`);
    }
  }

  if (result.ran.length || result.failed.length) {
    logger.info(
      `[migrations] pass complete: ${result.ran.length} applied, ${result.failed.length} failed, ${result.skipped.length} already applied`,
    );
  }
  return result;
}

function ensureLedgerTable(db: Database): void {
  db.run(
    `CREATE TABLE IF NOT EXISTS ${LEDGER_TABLE} (
       migration_id TEXT PRIMARY KEY,
       app_id       TEXT,
       title        TEXT,
       destructive  INTEGER NOT NULL DEFAULT 0,
       status       TEXT NOT NULL,
       applied_at   TEXT,
       result       TEXT,
       error        TEXT,
       logs         TEXT
     )`,
  );
}

function loadLedger(db: Database): Map<string, LedgerRow> {
  const rows = db
    .query(`SELECT migration_id, status FROM ${LEDGER_TABLE}`)
    .all() as LedgerRow[];
  return new Map(rows.map((r) => [r.migration_id, r]));
}

function markRunning(db: Database, migration: RegisteredMigration): void {
  // UPSERT so a retry of a previously failed/interrupted migration reuses its
  // row (the id is the primary key) instead of erroring on the insert.
  db.run(
    `INSERT INTO ${LEDGER_TABLE}
       (migration_id, app_id, title, destructive, status, applied_at, result, error, logs)
       VALUES (?, ?, ?, ?, 'running', ?, NULL, NULL, NULL)
     ON CONFLICT(migration_id) DO UPDATE SET
       app_id = excluded.app_id,
       title = excluded.title,
       destructive = excluded.destructive,
       status = 'running',
       applied_at = excluded.applied_at,
       result = NULL,
       error = NULL,
       logs = NULL`,
    migration.id,
    migration.appId,
    migration.title ?? migration.id,
    migration.destructive ? 1 : 0,
    nowRFC3339(),
  );
}

function markSucceeded(
  db: Database,
  id: string,
  summary: Record<string, unknown>,
  logs: string[],
): void {
  db.run(
    `UPDATE ${LEDGER_TABLE}
       SET status = 'succeeded', applied_at = ?, result = ?, error = NULL, logs = ?
     WHERE migration_id = ?`,
    nowRFC3339(),
    JSON.stringify(summary),
    JSON.stringify(logs),
    id,
  );
}

function markFailed(
  db: Database,
  id: string,
  message: string,
  logs: string[],
): void {
  db.run(
    `UPDATE ${LEDGER_TABLE}
       SET status = 'failed', applied_at = ?, error = ?, logs = ?
     WHERE migration_id = ?`,
    nowRFC3339(),
    message,
    JSON.stringify(logs),
    id,
  );
}
