/**
 * Unit tests for the `notifications-adopt-reminders` migration.
 *
 * Two things worth pinning down. First, that hand-typed reminders survive the
 * move and app-raised ones are deliberately left behind — their producers
 * rebuild them, and adopting them would race that rebuild. Second, that the old
 * audience rules are replayed faithfully, because a household row that named
 * three people becomes three rows and there is no second chance to get that
 * right.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { MigrationContext } from '@rambleraptor/homestead-core/apps/migrations';

interface Row {
  [k: string]: unknown;
}

const h = vi.hoisted(() => {
  const state = {
    users: [] as Row[],
    reminders: [] as Row[],
    queue: {} as Record<string, Row[]>,
    /** When true, reading the legacy collection throws (it's already dropped). */
    remindersGone: false,
    nextId: 1,
  };
  const writes = { created: [] as Array<Row & { userId: string }> };

  const queueFor = (userId: string) => ({
    listAll: async () => state.queue[userId] ?? [],
    create: async (payload: Row) => {
      const row = { id: `new-${state.nextId++}`, ...payload };
      (state.queue[userId] ??= []).push(row);
      writes.created.push({ ...row, userId });
      return row;
    },
  });

  const fakeHs = {
    collection: (name: string) => {
      if (name === 'users') {
        return {
          listAll: async () => state.users,
          record: (userId: string) => ({ collection: () => queueFor(userId) }),
        };
      }
      if (name === 'reminders') {
        return {
          listAll: async () => {
            if (state.remindersGone) throw new Error('404 no such collection');
            return state.reminders;
          },
        };
      }
      return { listAll: async () => [] };
    },
  };
  return { state, writes, fakeHs };
});

vi.mock('@rambleraptor/homestead-core/server/client', () => ({
  serverClient: () => h.fakeHs,
}));

import migrate from '../migrations/adopt-reminders';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const at = (days: number) =>
  new Date(NOW.getTime() + days * 86_400_000).toISOString();

function ctx(): MigrationContext {
  return {
    id: 'notifications-adopt-reminders',
    appId: 'notifications',
    token: 'admin-token',
    log: async () => {},
  };
}

function reminder(overrides: Row = {}): Row {
  return {
    id: 'r1',
    title: 'Call the plumber',
    notes: 'The upstairs tap.',
    due_at: at(3),
    status: 'pending',
    visibility: 'household',
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  h.state.users = [{ id: 'u1' }, { id: 'u2' }];
  h.state.reminders = [];
  h.state.queue = {};
  h.state.remindersGone = false;
  h.state.nextId = 1;
  h.writes.created = [];
});

describe('adopt-reminders', () => {
  test('a household reminder reaches everyone, one row each', async () => {
    h.state.reminders = [reminder()];

    const result = await migrate(ctx());

    expect(result).toMatchObject({ adopted: 1, rows: 2 });
    expect(h.writes.created.map((r) => r.userId).sort()).toEqual(['u1', 'u2']);
    expect(h.writes.created[0]).toMatchObject({
      title: 'Call the plumber',
      message: 'The upstairs tap.',
      send_at: at(3),
      status: 'scheduled',
      source_key: 'adopted:r1',
      source_id: 'r1',
    });
  });

  test('an adopted row belongs to the person, not to an app', async () => {
    h.state.reminders = [reminder()];
    await migrate(ctx());

    // No `source_app` means no producer's reconcile will ever see it — which
    // is what makes it editable in the Scheduled tab and safe from a sweep.
    expect(h.writes.created[0].source_app).toBeUndefined();
  });

  test('an explicit audience wins over the household', async () => {
    h.state.reminders = [reminder({ notify_users: ['u2'] })];

    const result = await migrate(ctx());

    expect(result).toMatchObject({ rows: 1 });
    expect(h.writes.created[0].userId).toBe('u2');
  });

  test('a private reminder reaches only its owner', async () => {
    h.state.reminders = [reminder({ visibility: 'private', created_by: 'users/u2' })];

    const result = await migrate(ctx());

    expect(result).toMatchObject({ rows: 1 });
    expect(h.writes.created[0].userId).toBe('u2');
  });

  test('a private reminder nobody owns is skipped, not broadcast', async () => {
    h.state.reminders = [reminder({ visibility: 'private' })];

    const result = await migrate(ctx());

    // It was never deliverable — the engine's `_owner` isn't exposed — and
    // guessing "everyone" would leak it to the household.
    expect(result).toMatchObject({ adopted: 0, skipped: 1 });
  });

  test('an app-raised reminder is left behind on purpose', async () => {
    h.state.reminders = [reminder({ id: 'r2', type: 'home', notify_users: ['u1'] })];

    const result = await migrate(ctx());

    // The home producer rebuilds this within seconds of boot (`runOnStart`),
    // so adopting it would mean two rows for one bin night.
    expect(result).toMatchObject({ adopted: 0, skipped: 1 });
    expect(h.writes.created).toHaveLength(0);
  });

  test('a done reminder is not queued', async () => {
    h.state.reminders = [reminder({ status: 'done' })];
    expect(await migrate(ctx())).toMatchObject({ adopted: 0, skipped: 1 });
  });

  test('a reminder whose moment has passed is not announced late', async () => {
    h.state.reminders = [reminder({ due_at: at(-1) })];
    expect(await migrate(ctx())).toMatchObject({ adopted: 0, skipped: 1 });
  });

  test('running twice adopts nothing the second time', async () => {
    h.state.reminders = [reminder()];
    await migrate(ctx());
    h.writes.created = [];

    const result = await migrate(ctx());

    expect(result).toMatchObject({ adopted: 0, rows: 0 });
    expect(h.writes.created).toHaveLength(0);
  });

  test('a half-finished run completes on the next boot', async () => {
    // u1 got their row before the crash; u2 didn't.
    h.state.reminders = [reminder()];
    h.state.queue = { u1: [{ id: 'existing', source_key: 'adopted:r1' }] };

    const result = await migrate(ctx());

    expect(result).toMatchObject({ rows: 1 });
    expect(h.writes.created[0].userId).toBe('u2');
  });

  test('an id for a user who no longer exists is dropped', async () => {
    h.state.reminders = [reminder({ notify_users: ['gone', 'u1'] })];

    const result = await migrate(ctx());

    expect(result).toMatchObject({ rows: 1 });
    expect(h.writes.created[0].userId).toBe('u1');
  });

  test('a missing notes field falls back to the title', async () => {
    h.state.reminders = [reminder({ notes: '  ' })];
    await migrate(ctx());
    expect(h.writes.created[0].message).toBe('Call the plumber');
  });

  test('a fresh instance with no reminders collection is a no-op', async () => {
    h.state.remindersGone = true;

    const result = await migrate(ctx());

    expect(result).toMatchObject({ scanned: 0, adopted: 0 });
  });
});
