/**
 * Boot-time data-migration runner: applies each declared migration once,
 * records the outcome in the `_homestead_migrations` ledger, skips ones already
 * succeeded, and retries ones that failed or were interrupted.
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { runMigrations } from '../src/migrations';
import type { Database } from '../src/engine/sqlite';
import type { RegisteredMigration } from '@rambleraptor/homestead-core/apps/registry';
import type { MigrationContext } from '@rambleraptor/homestead-core/apps/migrations';
import { makeEngine, type TestEngine } from './engine/helpers';

/** Build a migration whose handler is an inline function (no lazy module). */
function migration(
  id: string,
  handler: (ctx: MigrationContext) => Promise<Record<string, unknown> | void>,
  extra: Partial<RegisteredMigration> = {},
): RegisteredMigration {
  return {
    id,
    appId: 'test-app',
    load: async () => ({ default: handler }),
    ...extra,
  };
}

/** A silent logger so test output stays clean. */
const silent = { info() {}, warn() {}, error() {} };

interface LedgerRow {
  migration_id: string;
  status: string;
  result: string | null;
  error: string | null;
  logs: string | null;
  destructive: number;
}

function ledger(db: Database): LedgerRow[] {
  return db
    .query(
      `SELECT migration_id, status, result, error, logs, destructive
         FROM _homestead_migrations ORDER BY migration_id`,
    )
    .all() as LedgerRow[];
}

describe('runMigrations', () => {
  let t: TestEngine;
  let db: Database;

  beforeEach(async () => {
    t = await makeEngine();
    db = t.engine.db;
  });

  test('applies pending migrations and records their result in the ledger', async () => {
    const calls: string[] = [];
    const result = await runMigrations(db, {
      token: t.adminToken,
      logger: silent,
      migrations: [
        migration('a', async () => {
          calls.push('a');
          return { patched: 3 };
        }),
        migration('b', async () => {
          calls.push('b');
        }),
      ],
    });

    expect(calls).toEqual(['a', 'b']);
    expect(result).toEqual({ ran: ['a', 'b'], skipped: [], failed: [] });

    const rows = ledger(db);
    expect(rows.map((r) => [r.migration_id, r.status])).toEqual([
      ['a', 'succeeded'],
      ['b', 'succeeded'],
    ]);
    expect(JSON.parse(rows[0].result!)).toEqual({ patched: 3 });
    // A handler that returns nothing records an empty summary, not null.
    expect(JSON.parse(rows[1].result!)).toEqual({});
  });

  test('passes a working admin token so handlers can hit the engine', async () => {
    // The handler talks to the engine the way a real migration would — through
    // the token it's handed. Prove the token is live by whoami'ing with it.
    let whoamiStatus = 0;
    await runMigrations(db, {
      token: t.adminToken,
      logger: silent,
      migrations: [
        migration('whoami', async ({ token }) => {
          const res = await t.engine.fetch(
            new Request('http://localhost:8090/users/me', {
              headers: { Authorization: `Bearer ${token}` },
            }),
          );
          whoamiStatus = res.status;
        }),
      ],
    });
    expect(whoamiStatus).toBe(200);
  });

  test('skips migrations already recorded as succeeded (idempotent)', async () => {
    const calls: string[] = [];
    const once = migration('once', async () => {
      calls.push('run');
    });

    await runMigrations(db, { token: t.adminToken, logger: silent, migrations: [once] });
    const second = await runMigrations(db, {
      token: t.adminToken,
      logger: silent,
      migrations: [once],
    });

    expect(calls).toEqual(['run']); // handler invoked exactly once
    expect(second).toEqual({ ran: [], skipped: ['once'], failed: [] });
  });

  test('records a throwing handler as failed without stopping later migrations', async () => {
    const calls: string[] = [];
    const result = await runMigrations(db, {
      token: t.adminToken,
      logger: silent,
      migrations: [
        migration('boom', async () => {
          calls.push('boom');
          throw new Error('kaboom');
        }),
        migration('after', async () => {
          calls.push('after');
        }),
      ],
    });

    expect(calls).toEqual(['boom', 'after']); // failure did not abort the pass
    expect(result).toEqual({ ran: ['after'], skipped: [], failed: ['boom'] });

    const rows = ledger(db);
    const boom = rows.find((r) => r.migration_id === 'boom')!;
    expect(boom.status).toBe('failed');
    expect(boom.error).toBe('kaboom');
  });

  test('retries a previously failed migration on the next pass', async () => {
    let attempt = 0;
    const flaky = migration('flaky', async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('first try fails');
      return { attempt };
    });

    const first = await runMigrations(db, {
      token: t.adminToken,
      logger: silent,
      migrations: [flaky],
    });
    expect(first.failed).toEqual(['flaky']);

    const second = await runMigrations(db, {
      token: t.adminToken,
      logger: silent,
      migrations: [flaky],
    });
    expect(second.ran).toEqual(['flaky']);

    const row = ledger(db).find((r) => r.migration_id === 'flaky')!;
    expect(row.status).toBe('succeeded');
    expect(JSON.parse(row.result!)).toEqual({ attempt: 2 });
    // The stale error from the first attempt is cleared on success.
    expect(row.error).toBeNull();
  });

  test('captures ctx.log lines and the destructive flag in the ledger', async () => {
    await runMigrations(db, {
      token: t.adminToken,
      logger: silent,
      migrations: [
        migration(
          'chatty',
          async ({ log }) => {
            await log('step one');
            await log('step two');
          },
          { destructive: true },
        ),
      ],
    });

    const row = ledger(db).find((r) => r.migration_id === 'chatty')!;
    expect(JSON.parse(row.logs!)).toEqual(['step one', 'step two']);
    expect(row.destructive).toBe(1);
  });
});
