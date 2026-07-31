/**
 * Worked example: a data migration end to end.
 *
 * Scenario — you shipped a new `status` field on `gift-card` and want existing
 * rows backfilled from their `amount`/`archived` values. This test plays the
 * whole path against a real engine:
 *
 *   1. the collection exists with the new field (what the schema sync leaves you
 *      with after adding `status` to resources.ts),
 *   2. old rows exist with no `status` (created before the field did),
 *   3. the migration runs through the runner, using the real homestead-client
 *      to read and rewrite records,
 *   4. the ledger records the outcome, and a second pass is a no-op.
 *
 * The handler is written exactly as an app's `migrations/backfill-status.ts`
 * would be — the only test-specific piece is the injected `fetch` that routes
 * the client at the in-process engine (in production the client points at
 * `AEPBASE_URL` and the real `/api/aep` gateway does this routing).
 */

import { describe, expect, test } from 'vitest';
import { createHomesteadClient, bearerToken } from '@rambleraptor/homestead-client';
import { runMigrations } from '../src/migrations';
import type { RegisteredMigration } from '@rambleraptor/homestead-core/apps/registry';
import type { MigrationHandler } from '@rambleraptor/homestead-core/apps/migrations';
import { call, defineResource, makeEngine } from './engine/helpers';
import type { Engine } from '../src/engine/engine';

interface GiftCard {
  id: string;
  merchant: string;
  amount: number;
  archived?: boolean;
  status?: string;
}

/**
 * A `fetch` bound to the in-process engine. The client normalizes its base to
 * end in `/api/aep`; the raw Engine routes bare paths (`/gift-cards`), so strip
 * that prefix. In a running server the gateway does this — here we stand in for
 * it.
 */
function engineFetch(engine: Engine): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input.toString();
    const url = new URL(raw);
    url.pathname = url.pathname.replace(/^\/api\/aep/, '');
    return engine.fetch(new Request(url.toString(), init));
  }) as typeof fetch;
}

describe('data migration — end to end', () => {
  test('backfills status on existing gift-cards, records the ledger, and is idempotent', async () => {
    const t = await makeEngine();
    const { engine, adminToken, db } = { ...t, db: t.engine.db };

    // (1) The collection as the schema sync would leave it after `status` was
    //     added to resources.ts: the field exists on the definition.
    await defineResource(t, {
      singular: 'gift-card',
      plural: 'gift-cards',
      user_settable_create: true,
      schema: {
        type: 'object',
        properties: {
          merchant: { type: 'string' },
          amount: { type: 'number' },
          archived: { type: 'boolean' },
          status: { type: 'string' }, // new field — old rows don't have it yet
        },
        required: ['merchant', 'amount'],
      },
    });

    // (2) Old rows, created before `status` existed — none carry it.
    const seed = [
      { merchant: 'REI', amount: 40, archived: false }, // → active
      { merchant: 'Target', amount: 0, archived: false }, // → depleted (empty)
      { merchant: 'Old Navy', amount: 25, archived: true }, // → depleted (archived)
    ];
    for (const body of seed) {
      const res = await call(engine, 'POST', '/gift-cards', { token: adminToken, body });
      expect(res.ok).toBe(true);
    }

    // --- the migration handler, exactly as an app would author it -------------
    const backfillStatus: MigrationHandler = async ({ token, log }) => {
      const hs = createHomesteadClient({
        baseUrl: 'http://localhost:8090',
        auth: bearerToken(token),
        fetch: engineFetch(engine),
      });
      const cards = hs.collection<GiftCard>('gift-cards');

      let scanned = 0;
      let patched = 0;
      for await (const card of cards.list()) {
        scanned++;
        if (card.status) continue; // idempotent guard — skip rows already done
        const status =
          !card.archived && (card.amount ?? 0) > 0 ? 'active' : 'depleted';
        await cards.record(card.id).update({ status });
        patched++;
      }
      await log(`patched ${patched} of ${scanned}`);
      return { scanned, patched };
    };
    // -------------------------------------------------------------------------

    const migration: RegisteredMigration = {
      id: 'gift-cards-backfill-status',
      title: 'Backfill gift-card status from amount',
      appId: 'gift-cards',
      load: async () => ({ default: backfillStatus }),
    };

    // (3) Run it through the same runner the server calls at boot.
    const first = await runMigrations(db, {
      token: adminToken,
      migrations: [migration],
      logger: { info() {}, warn() {}, error() {} },
    });
    expect(first).toEqual({ ran: ['gift-cards-backfill-status'], skipped: [], failed: [] });

    // The data is transformed.
    const hs = createHomesteadClient({
      baseUrl: 'http://localhost:8090',
      auth: bearerToken(adminToken),
      fetch: engineFetch(engine),
    });
    const byMerchant = Object.fromEntries(
      (await hs.collection<GiftCard>('gift-cards').listAll()).map((c) => [c.merchant, c.status]),
    );
    expect(byMerchant).toEqual({ REI: 'active', Target: 'depleted', 'Old Navy': 'depleted' });

    // (4) The ledger recorded the outcome.
    const row = db
      .query(
        `SELECT status, result, logs FROM _homestead_migrations WHERE migration_id = ?`,
      )
      .get('gift-cards-backfill-status') as {
      status: string;
      result: string;
      logs: string;
    };
    expect(row.status).toBe('succeeded');
    expect(JSON.parse(row.result)).toEqual({ scanned: 3, patched: 3 });
    expect(JSON.parse(row.logs)).toEqual(['patched 3 of 3']);

    // A second pass is a no-op — the ledger skips it, nothing is re-patched.
    const second = await runMigrations(db, {
      token: adminToken,
      migrations: [migration],
      logger: { info() {}, warn() {}, error() {} },
    });
    expect(second).toEqual({ ran: [], skipped: ['gift-cards-backfill-status'], failed: [] });
  });
});
