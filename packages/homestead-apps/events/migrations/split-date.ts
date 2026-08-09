/**
 * `events-split-date` migration.
 *
 * Splits each existing event's legacy `date` (a full ISO date-time) into the
 * new `month` + `day` fields. The **year is intentionally not backfilled** — a
 * required date meant users often typed a placeholder they never meant as a
 * birth/wedding year, so an origin year is only recorded when someone sets it
 * explicitly from the form.
 *
 * Idempotent: an event that already has `month`/`day` is skipped, so a re-run
 * (or a resumed pass) never clobbers a value the form has since written.
 *
 * Server-only: lives under `migrations/`, so vite stubs it out of the browser
 * bundle. Runs once at boot with a short-lived admin token.
 */

import type { MigrationHandler } from '@rambleraptor/homestead-core/apps/migrations';
import { serverClient } from '@rambleraptor/homestead-core/server/client';
import { EVENTS } from '../resources';
import type { Event } from '../types';

const migrate: MigrationHandler = async ({ token, log }) => {
  const events = serverClient(token).collection<Event>(EVENTS);
  const all = await events.listAll();

  let patched = 0;
  let skipped = 0;
  for (const ev of all) {
    if (Number.isInteger(ev.month) && Number.isInteger(ev.day)) {
      skipped++; // already migrated
      continue;
    }
    const date = ev.date?.trim();
    if (!date) {
      skipped++;
      continue;
    }
    const [, m, d] = date.substring(0, 10).split('-').map(Number);
    if (!m || !d) {
      skipped++;
      continue;
    }
    await events.record(ev.id).update({ month: m, day: d });
    if (++patched % 50 === 0) await log(`patched ${patched}…`);
  }

  return { scanned: all.length, patched, skipped };
};

export default migrate;
