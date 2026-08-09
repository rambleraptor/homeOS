/**
 * Unit tests for the `events-split-date` migration: it splits a legacy `date`
 * into month/day, never backfills a year, and is idempotent.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { MigrationContext } from '@rambleraptor/homestead-core/apps/migrations';

interface Row {
  [k: string]: unknown;
}

const h = vi.hoisted(() => {
  const state = { events: [] as Row[] };
  const updates: Array<{ id: string; body: Row }> = [];
  const fakeHs = {
    collection: () => ({
      listAll: async () => state.events,
      record: (id: string) => ({
        update: async (body: Row) => {
          updates.push({ id, body });
        },
      }),
    }),
  };
  return { state, updates, fakeHs };
});

vi.mock('@rambleraptor/homestead-core/server/client', () => ({
  serverClient: () => h.fakeHs,
}));

import migrate from '../split-date';

function ctx(): MigrationContext {
  return { id: 'events-split-date', token: 'admin', log: async () => {} };
}

beforeEach(() => {
  h.state.events = [];
  h.updates.length = 0;
});

describe('events-split-date migration', () => {
  test('splits a legacy date into month/day and leaves the year unset', async () => {
    h.state.events = [{ id: 'e1', name: 'Birthday', date: '1990-06-20' }];

    const result = await migrate(ctx());

    expect(h.updates).toEqual([{ id: 'e1', body: { month: 6, day: 20 } }]);
    expect(h.updates[0].body).not.toHaveProperty('year');
    expect(result).toMatchObject({ scanned: 1, patched: 1, skipped: 0 });
  });

  test('skips events already carrying month/day (idempotent)', async () => {
    h.state.events = [{ id: 'e1', month: 6, day: 20, date: '1990-06-20' }];

    const result = await migrate(ctx());

    expect(h.updates).toEqual([]);
    expect(result).toMatchObject({ patched: 0, skipped: 1 });
  });

  test('skips an event with no legacy date', async () => {
    h.state.events = [{ id: 'e1', name: 'No date' }];

    const result = await migrate(ctx());

    expect(h.updates).toEqual([]);
    expect(result).toMatchObject({ patched: 0, skipped: 1 });
  });
});
