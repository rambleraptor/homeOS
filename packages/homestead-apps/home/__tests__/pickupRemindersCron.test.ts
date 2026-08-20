/**
 * Unit tests for the `home-pickup-reminders` cron handler.
 *
 * The engine client is mocked with an in-memory reminders collection, so what's
 * under test is the handler's own logic: reading each household member's opt-in,
 * folding a collection day's streams into one reminder due the evening before,
 * and reconciling with what an earlier run wrote.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { CronContext } from '@rambleraptor/homestead-core/apps/types';

interface Row {
  [k: string]: unknown;
}

const h = vi.hoisted(() => {
  const state = {
    users: [] as Row[],
    optedIn: [] as string[],
    pickups: [] as Row[],
    reminders: [] as Row[],
    nextId: 1,
  };
  const writes = {
    created: [] as Row[],
    updated: [] as Array<{ id: string; patch: Row }>,
    deleted: [] as string[],
  };
  const remindersCollection = {
    listAll: async () => state.reminders,
    create: async (payload: Row) => {
      const row = { id: `new-${state.nextId++}`, ...payload };
      state.reminders.push(row);
      writes.created.push(row);
      return row;
    },
    record: (id: string) => ({
      update: async (patch: Row) => {
        writes.updated.push({ id, patch });
        const row = state.reminders.find((r) => r.id === id);
        if (row) Object.assign(row, patch);
        return row;
      },
      delete: async () => {
        writes.deleted.push(id);
        state.reminders = state.reminders.filter((r) => r.id !== id);
      },
    }),
  };
  const fakeHs = {
    collection: (name: string) => {
      if (name === 'users') return { listAll: async () => state.users };
      if (name === 'garbage-pickups') return { listAll: async () => state.pickups };
      if (name === 'reminders') return remindersCollection;
      return { listAll: async () => [] };
    },
  };
  return { state, writes, fakeHs };
});

vi.mock('@rambleraptor/homestead-core/server/client', () => ({
  serverClient: () => h.fakeHs,
}));
vi.mock('@rambleraptor/homestead-core/server/user-settings', () => ({
  usersWithFlag: async (_token: string, userIds: readonly string[]) =>
    userIds.filter((id) => h.state.optedIn.includes(id)),
}));

import handler, { buildContent, joinStreams } from '../crons/pickup-reminders';

/** Fixed clock: 2026-06-15 04:00 local, a Monday. */
const NOW = new Date(2026, 5, 15, 4, 0, 0);

function ctx(): CronContext {
  return {
    id: 'home-pickup-reminders',
    appId: 'home',
    token: 'admin-token',
    firedAt: NOW.toISOString(),
    log: async () => {},
  };
}

/** 18:00 local on the day `dayOffset` days from the 15th. */
const eveningAt = (dayOffset: number) =>
  new Date(2026, 5, 15 + dayOffset, 18, 0, 0, 0).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  h.state.users = [{ id: 'u1' }, { id: 'u2' }];
  h.state.optedIn = ['u1'];
  h.state.pickups = [];
  h.state.reminders = [];
  h.state.nextId = 1;
  h.writes.created = [];
  h.writes.updated = [];
  h.writes.deleted = [];
});

describe('joinStreams', () => {
  test('reads as a sentence, however many there are', () => {
    expect(joinStreams([])).toBe('');
    expect(joinStreams(['Trash'])).toBe('Trash');
    expect(joinStreams(['Trash', 'Recycling'])).toBe('Trash and Recycling');
    expect(joinStreams(['Trash', 'Recycling', 'Compost'])).toBe(
      'Trash, Recycling and Compost',
    );
  });
});

describe('buildContent', () => {
  test('names the bins and the day they go out', () => {
    expect(buildContent(['garbage', 'recyclable'], '2026-06-16')).toEqual({
      title: 'Bins out tonight: Trash and Recycling',
      notes: 'Trash and Recycling are collected tomorrow, Tuesday, June 16.',
    });
  });

  test('agrees with a single stream', () => {
    expect(buildContent(['garbage'], '2026-06-16').notes).toBe(
      'Trash is collected tomorrow, Tuesday, June 16.',
    );
  });
});

describe('pickup reminders', () => {
  test('one collection day becomes one reminder, due the evening before', async () => {
    h.state.pickups = [
      { id: 'p1', pickup_date: '2026-06-16', stream: 'garbage' },
      { id: 'p2', pickup_date: '2026-06-16', stream: 'recyclable' },
    ];

    const result = await handler(ctx());

    expect(result).toMatchObject({ optedIn: 1, planned: 1, created: 1 });
    expect(h.writes.created[0]).toMatchObject({
      title: 'Bins out tonight: Trash and Recycling',
      due_at: eveningAt(0),
      type: 'home',
      source_key: 'pickup:2026-06-16',
      visibility: 'household',
      status: 'pending',
      notify_users: ['u1'],
    });
  });

  test('nobody opted in means nothing is written', async () => {
    h.state.optedIn = [];
    h.state.pickups = [{ id: 'p1', pickup_date: '2026-06-16', stream: 'garbage' }];

    const result = await handler(ctx());

    expect(result).toMatchObject({ planned: 0, created: 0 });
  });

  test('everyone opted in is addressed on the one row', async () => {
    h.state.optedIn = ['u1', 'u2'];
    h.state.pickups = [{ id: 'p1', pickup_date: '2026-06-16', stream: 'garbage' }];

    await handler(ctx());

    expect(h.writes.created[0].notify_users).toEqual(['u1', 'u2']);
  });

  test('today’s collection is not announced — that evening has gone', async () => {
    h.state.pickups = [{ id: 'p1', pickup_date: '2026-06-15', stream: 'garbage' }];
    const result = await handler(ctx());
    expect(result).toMatchObject({ planned: 0 });
  });

  test('a collection beyond the horizon waits for a later run', async () => {
    h.state.pickups = [{ id: 'p1', pickup_date: '2026-07-20', stream: 'garbage' }];
    const result = await handler(ctx());
    expect(result).toMatchObject({ planned: 0 });
  });

  test('a duplicated stream on one day is only named once', async () => {
    h.state.pickups = [
      { id: 'p1', pickup_date: '2026-06-16', stream: 'garbage' },
      { id: 'p2', pickup_date: '2026-06-16', stream: 'garbage' },
    ];

    await handler(ctx());

    expect(h.writes.created[0].title).toBe('Bins out tonight: Trash');
  });

  test('a second run over the same schedule writes nothing', async () => {
    h.state.pickups = [{ id: 'p1', pickup_date: '2026-06-16', stream: 'garbage' }];
    await handler(ctx());
    h.writes.created = [];

    const result = await handler(ctx());

    expect(result).toMatchObject({ created: 0, updated: 0, unchanged: 1 });
  });

  test('a holiday shift moves the reminder it already wrote', async () => {
    h.state.pickups = [{ id: 'p1', pickup_date: '2026-06-16', stream: 'garbage' }];
    await handler(ctx());

    // The hauler pushed the day; the sync rewrote the row, so the old date is
    // no longer implied and the new one is.
    h.state.pickups = [
      { id: 'p1', pickup_date: '2026-06-17', stream: 'garbage', status: 'delayed' },
    ];
    const result = await handler(ctx());

    expect(result).toMatchObject({ created: 1, withdrawn: 1 });
    expect(h.state.reminders).toHaveLength(1);
    expect(h.state.reminders[0]).toMatchObject({
      source_key: 'pickup:2026-06-17',
      due_at: eveningAt(1),
    });
  });

  test('opting out withdraws the reminders already written', async () => {
    h.state.pickups = [{ id: 'p1', pickup_date: '2026-06-16', stream: 'garbage' }];
    await handler(ctx());
    expect(h.state.reminders).toHaveLength(1);

    h.state.optedIn = [];
    const result = await handler(ctx());

    expect(result).toMatchObject({ withdrawn: 1 });
    expect(h.state.reminders).toHaveLength(0);
  });

  test('a reminder from another app is never touched', async () => {
    h.state.reminders = [
      {
        id: 'e1',
        title: 'Today: Mum’s birthday',
        due_at: new Date(2026, 5, 20, 9).toISOString(),
        type: 'events',
        source_key: 'ev1:day_of:2026',
      },
    ];
    h.state.pickups = [];

    const result = await handler(ctx());

    expect(result).toMatchObject({ withdrawn: 0, pruned: 0 });
    expect(h.writes.deleted).toHaveLength(0);
  });

  test('a long-past bin night is swept', async () => {
    h.state.reminders = [
      {
        id: 'old',
        title: 'Bins out tonight: Trash',
        due_at: new Date(2026, 4, 1, 18).toISOString(),
        type: 'home',
        source_key: 'pickup:2026-05-02',
      },
    ];

    const result = await handler(ctx());

    expect(result).toMatchObject({ pruned: 1 });
  });
});
