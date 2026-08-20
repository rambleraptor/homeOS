/**
 * Unit tests for the `events-materialize-reminders` cron handler.
 *
 * The engine client is mocked with an in-memory reminders collection that
 * records writes, so what's under test is the handler's real logic: expanding
 * each user's per-event lead into due instants, addressing the reminder to the
 * people who opted in, and reconciling against what a previous run already
 * wrote (including withdrawing a reminder nobody wants any more).
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { CronContext } from '@rambleraptor/homestead-core/apps/types';

interface Row {
  [k: string]: unknown;
}

const h = vi.hoisted(() => {
  const state = {
    events: [] as Row[],
    users: [] as Row[],
    prefsByUser: {} as Record<string, Row[]>,
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
      if (name === 'users') {
        return {
          listAll: async () => state.users,
          record: (userId: string) => ({
            collection: () => ({
              listAll: async () => state.prefsByUser[userId] ?? [],
            }),
          }),
        };
      }
      if (name === 'events') return { listAll: async () => state.events };
      if (name === 'reminders') return remindersCollection;
      return { listAll: async () => [] };
    },
  };
  return { state, writes, fakeHs };
});

vi.mock('@rambleraptor/homestead-core/server/client', () => ({
  serverClient: () => h.fakeHs,
}));

import handler from '../crons/materialize';
import { nextOccurrence } from '../utils/eventDate';

/** Fixed clock: 2026-06-15 01:00 local. `nextOccurrence` reads `new Date()`. */
const NOW = new Date(2026, 5, 15, 1, 0, 0);

function ctx(): CronContext {
  return {
    id: 'events-materialize-reminders',
    appId: 'events',
    token: 'admin-token',
    firedAt: NOW.toISOString(),
    log: async () => {},
  };
}

/** The 09:00 instant on the day `dayOffset` days from the 15th. */
const morningAt = (dayOffset: number) =>
  new Date(2026, 5, 15 + dayOffset, 9, 0, 0, 0).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  h.state.events = [];
  h.state.users = [{ id: 'u1' }, { id: 'u2' }];
  h.state.prefsByUser = {};
  h.state.reminders = [];
  h.state.nextId = 1;
  h.writes.created = [];
  h.writes.updated = [];
  h.writes.deleted = [];
});

describe('events materializer', () => {
  test('a day-of opt-in becomes a reminder due that morning', async () => {
    // June 22 — a week out, so day_of is outside the horizon; use June 15.
    h.state.events = [{ id: 'e1', name: 'Mum’s birthday', month: 6, day: 15 }];
    h.state.prefsByUser = { u1: [{ id: 'p1', event_id: 'e1', lead: 'day_of' }] };

    const result = await handler(ctx());

    expect(result).toMatchObject({ planned: 1, created: 1 });
    expect(h.writes.created[0]).toMatchObject({
      title: 'Today: Mum’s birthday',
      due_at: morningAt(0),
      type: 'events',
      source_key: 'e1:day_of:2026',
      visibility: 'household',
      status: 'pending',
      notify_users: ['u1'],
    });
  });

  test('a week-before opt-in is due seven days ahead of the event', async () => {
    // June 22 is a week out, so the week-before moment is this morning.
    h.state.events = [{ id: 'e1', name: 'Mum’s birthday', month: 6, day: 22 }];
    h.state.prefsByUser = {
      u1: [{ id: 'p1', event_id: 'e1', lead: 'week_before' }],
    };

    await handler(ctx());

    expect(h.writes.created).toHaveLength(1);
    expect(h.writes.created[0]).toMatchObject({
      title: 'Next week: Mum’s birthday',
      due_at: morningAt(0),
      source_key: 'e1:week_before:2026',
    });
  });

  test('`both` expands into two reminders when both moments are in range', async () => {
    h.state.events = [{ id: 'e1', name: 'Mum’s birthday', month: 6, day: 22 }];
    h.state.prefsByUser = { u1: [{ id: 'p1', event_id: 'e1', lead: 'both' }] };

    const result = await handler(ctx());

    expect(result).toMatchObject({ planned: 2, created: 2 });
    expect(h.writes.created.map((r) => r.source_key).sort()).toEqual([
      'e1:day_of:2026',
      'e1:week_before:2026',
    ]);
  });

  test('a lead whose moment has already gone by is not backfilled', async () => {
    // The event is tomorrow, so its week-before moment was six days ago —
    // outside the horizon's one-day tail. Only day_of lands.
    h.state.events = [{ id: 'e1', name: 'Mum’s birthday', month: 6, day: 16 }];
    h.state.prefsByUser = { u1: [{ id: 'p1', event_id: 'e1', lead: 'both' }] };

    const result = await handler(ctx());

    expect(result).toMatchObject({ planned: 1 });
    expect(h.writes.created[0]).toMatchObject({ source_key: 'e1:day_of:2026' });
  });

  test('one reminder carries everyone who opted in for that lead', async () => {
    h.state.events = [{ id: 'e1', name: 'Mum’s birthday', month: 6, day: 15 }];
    h.state.prefsByUser = {
      u1: [{ id: 'p1', event_id: 'e1', lead: 'day_of' }],
      u2: [{ id: 'p2', event_id: 'e1', lead: 'both' }],
    };

    const result = await handler(ctx());

    expect(result).toMatchObject({ created: 1 });
    expect(h.writes.created[0].notify_users).toEqual(['u1', 'u2']);
  });

  test('an event nobody opted into produces nothing', async () => {
    h.state.events = [{ id: 'e1', name: 'Mum’s birthday', month: 6, day: 15 }];
    const result = await handler(ctx());
    expect(result).toMatchObject({ planned: 0, created: 0 });
  });

  test('an event beyond the horizon waits for a later run', async () => {
    h.state.events = [{ id: 'e1', name: 'Mum’s birthday', month: 8, day: 1 }];
    h.state.prefsByUser = { u1: [{ id: 'p1', event_id: 'e1', lead: 'both' }] };
    const result = await handler(ctx());
    expect(result).toMatchObject({ planned: 0 });
  });

  test('an event with no usable date is skipped', async () => {
    h.state.events = [{ id: 'e1', name: 'Broken', month: 13, day: 40 }];
    h.state.prefsByUser = { u1: [{ id: 'p1', event_id: 'e1', lead: 'day_of' }] };
    const result = await handler(ctx());
    expect(result).toMatchObject({ planned: 0, created: 0 });
  });

  test('a second run over the same state writes nothing', async () => {
    h.state.events = [{ id: 'e1', name: 'Mum’s birthday', month: 6, day: 15 }];
    h.state.prefsByUser = { u1: [{ id: 'p1', event_id: 'e1', lead: 'day_of' }] };

    await handler(ctx());
    h.writes.created = [];
    const result = await handler(ctx());

    expect(result).toMatchObject({ created: 0, updated: 0, unchanged: 1 });
    expect(h.writes.created).toHaveLength(0);
  });

  test('a renamed event repoints the reminder it already wrote', async () => {
    h.state.events = [{ id: 'e1', name: 'Mum’s birthday', month: 6, day: 15 }];
    h.state.prefsByUser = { u1: [{ id: 'p1', event_id: 'e1', lead: 'day_of' }] };
    await handler(ctx());

    h.state.events[0].name = 'Mother’s birthday';
    const result = await handler(ctx());

    expect(result).toMatchObject({ created: 0, updated: 1 });
    expect(h.writes.updated[0].patch).toMatchObject({
      title: 'Today: Mother’s birthday',
    });
  });

  test('a new opt-in is added to the existing reminder', async () => {
    h.state.events = [{ id: 'e1', name: 'Mum’s birthday', month: 6, day: 16 }];
    h.state.prefsByUser = { u1: [{ id: 'p1', event_id: 'e1', lead: 'day_of' }] };
    await handler(ctx());

    h.state.prefsByUser.u2 = [{ id: 'p2', event_id: 'e1', lead: 'day_of' }];
    const result = await handler(ctx());

    expect(result).toMatchObject({ updated: 1 });
    expect(h.writes.updated[0].patch.notify_users).toEqual(['u1', 'u2']);
  });

  test('the last opt-out withdraws a future reminder', async () => {
    h.state.events = [{ id: 'e1', name: 'Mum’s birthday', month: 6, day: 16 }];
    h.state.prefsByUser = { u1: [{ id: 'p1', event_id: 'e1', lead: 'day_of' }] };
    await handler(ctx());
    const written = h.state.reminders[0].id as string;

    h.state.prefsByUser = {};
    const result = await handler(ctx());

    expect(result).toMatchObject({ withdrawn: 1 });
    expect(h.writes.deleted).toEqual([written]);
  });

  test('a reminder whose moment has passed is left alone, then swept', async () => {
    h.state.reminders = [
      {
        id: 'old',
        title: 'Today: Mum’s birthday',
        due_at: new Date(2026, 5, 14, 9).toISOString(),
        type: 'events',
        source_key: 'e1:day_of:2026',
      },
    ];

    const first = await handler(ctx());
    expect(first).toMatchObject({ withdrawn: 0, pruned: 0 });

    h.state.reminders[0].due_at = new Date(2026, 3, 1, 9).toISOString();
    const later = await handler(ctx());
    expect(later).toMatchObject({ pruned: 1 });
  });

  test('a reminder someone typed in is never touched', async () => {
    h.state.reminders = [
      {
        id: 'mine',
        title: 'Call the plumber',
        due_at: new Date(2026, 5, 20, 9).toISOString(),
      },
      {
        id: 'theirs',
        title: 'Bins out tonight: Trash',
        due_at: new Date(2026, 5, 20, 18).toISOString(),
        type: 'home',
        source_key: 'pickup:2026-06-21',
      },
    ];

    const result = await handler(ctx());

    expect(result).toMatchObject({ withdrawn: 0, pruned: 0, updated: 0 });
    expect(h.writes.deleted).toHaveLength(0);
  });

  test('a pathed event_id on a preference still matches its event', async () => {
    h.state.events = [{ id: 'e1', name: 'Mum’s birthday', month: 6, day: 15 }];
    h.state.prefsByUser = {
      u1: [{ id: 'p1', event_id: 'events/e1', lead: 'day_of' }],
    };
    const result = await handler(ctx());
    expect(result).toMatchObject({ created: 1 });
  });

  test('an event carries its age label into the reminder', async () => {
    h.state.events = [
      { id: 'e1', name: 'Mum’s birthday', month: 6, day: 15, year: 1970, tag: 'birthday' },
    ];
    h.state.prefsByUser = { u1: [{ id: 'p1', event_id: 'e1', lead: 'day_of' }] };
    await handler(ctx());
    expect(h.writes.created[0].notes).toBe(
      'Mum’s birthday is today (June 15). Turning 56.',
    );
  });

  test('the reminder is due on the occurrence the recurrence picks', async () => {
    h.state.events = [{ id: 'e1', name: 'Mum’s birthday', month: 6, day: 15 }];
    h.state.prefsByUser = { u1: [{ id: 'p1', event_id: 'e1', lead: 'day_of' }] };
    await handler(ctx());

    const occurrence = nextOccurrence({ month: 6, day: 15 });
    expect(new Date(h.writes.created[0].due_at as string).getDate()).toBe(
      occurrence.getDate(),
    );
  });
});
