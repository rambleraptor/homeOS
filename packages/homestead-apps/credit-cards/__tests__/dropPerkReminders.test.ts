/**
 * Unit tests for the `credit-cards-drop-perk-reminders` migration.
 *
 * The two failure modes this guards against are the ones that would otherwise
 * be invisible: a month of orphaned perk notifications still firing after the
 * feature was removed, and a `user-preference` column that refuses to drop
 * because somebody had opted in.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { MigrationContext } from '@rambleraptor/homestead-core/apps/migrations';

interface Row {
  [k: string]: unknown;
}

const h = vi.hoisted(() => {
  const state = {
    users: [] as Row[],
    queue: {} as Record<string, Row[]>,
    prefs: {} as Record<string, Row[]>,
  };
  const writes = {
    deleted: [] as Array<{ userId: string; id: string }>,
    updated: [] as Array<{ userId: string; id: string; patch: Row }>,
  };

  const childFor = (userId: string, kind: 'queue' | 'prefs') => ({
    listAll: async () => state[kind][userId] ?? [],
    record: (id: string) => ({
      update: async (patch: Row) => {
        writes.updated.push({ userId, id, patch });
        const row = (state[kind][userId] ?? []).find((r) => r.id === id);
        if (row) Object.assign(row, patch);
        return row;
      },
      delete: async () => {
        writes.deleted.push({ userId, id });
        state[kind][userId] = (state[kind][userId] ?? []).filter((r) => r.id !== id);
      },
    }),
  });

  const fakeHs = {
    collection: (name: string) => {
      if (name === 'users') {
        return {
          listAll: async () => state.users,
          record: (userId: string) => ({
            collection: (child: string) =>
              childFor(userId, child === 'preferences' ? 'prefs' : 'queue'),
          }),
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

import migrate, { PERK_REMINDER_FIELD } from '../migrations/drop-perk-reminders';

function ctx(): MigrationContext {
  return {
    id: 'credit-cards-drop-perk-reminders',
    appId: 'credit-cards',
    token: 'admin-token',
    log: async () => {},
  };
}

function queued(overrides: Row = {}): Row {
  return {
    id: 'q1',
    title: 'Dining credit closes June 30',
    send_at: '2026-06-26T09:00:00.000Z',
    status: 'scheduled',
    source_app: 'credit-cards',
    source_key: 'perk-window:c1:2026-06-30:monthly',
    ...overrides,
  };
}

beforeEach(() => {
  h.state.users = [{ id: 'u1' }, { id: 'u2' }];
  h.state.queue = {};
  h.state.prefs = {};
  h.writes.deleted = [];
  h.writes.updated = [];
});

describe('drop-perk-reminders', () => {
  test('withdraws perk notifications that have not fired', async () => {
    h.state.queue = { u1: [queued()] };

    const result = await migrate(ctx());

    // Nothing reconciles these any more, so without this they would keep
    // firing for up to a month after the feature was removed.
    expect(result).toMatchObject({ withdrawn: 1 });
    expect(h.state.queue.u1).toHaveLength(0);
  });

  test('leaves a delivered perk notification alone', async () => {
    h.state.queue = { u1: [queued({ status: 'sent' })] };

    const result = await migrate(ctx());

    // It already happened; the row is the record of that.
    expect(result).toMatchObject({ withdrawn: 0 });
    expect(h.state.queue.u1).toHaveLength(1);
  });

  test('never touches another app’s notifications', async () => {
    h.state.queue = {
      u1: [
        queued({ id: 'bin', source_app: 'home', source_key: 'pickup:2026-06-28' }),
        queued({ id: 'ev', source_app: 'events', source_key: 'e1:day_of:2026' }),
        queued({ id: 'mine', source_app: undefined, source_key: undefined }),
      ],
    };

    const result = await migrate(ctx());

    expect(result).toMatchObject({ withdrawn: 0 });
    expect(h.writes.deleted).toHaveLength(0);
  });

  test('clears the opt-in so the column can be dropped', async () => {
    h.state.prefs = { u1: [{ id: 'p1', [PERK_REMINDER_FIELD]: true }] };

    const result = await migrate(ctx());

    // The user-settings syncer sends no authorized-drops header, so an empty
    // column is the only way the drop is allowed through.
    expect(result).toMatchObject({ cleared: 1 });
    expect(h.writes.updated[0].patch).toEqual({ [PERK_REMINDER_FIELD]: null });
  });

  test('clears an explicit opt-out too — false is still a value', async () => {
    h.state.prefs = { u1: [{ id: 'p1', [PERK_REMINDER_FIELD]: false }] };
    expect(await migrate(ctx())).toMatchObject({ cleared: 1 });
  });

  test('leaves other preferences on the same row untouched', async () => {
    h.state.prefs = {
      u1: [{ id: 'p1', [PERK_REMINDER_FIELD]: true, home__pickup_reminder: true }],
    };

    await migrate(ctx());

    expect(h.writes.updated[0].patch).not.toHaveProperty('home__pickup_reminder');
    expect(h.state.prefs.u1[0].home__pickup_reminder).toBe(true);
  });

  test('works across every household member', async () => {
    h.state.queue = { u1: [queued({ id: 'a' })], u2: [queued({ id: 'b' })] };
    h.state.prefs = {
      u1: [{ id: 'p1', [PERK_REMINDER_FIELD]: true }],
      u2: [{ id: 'p2', [PERK_REMINDER_FIELD]: true }],
    };

    const result = await migrate(ctx());

    expect(result).toMatchObject({ users: 2, withdrawn: 2, cleared: 2 });
  });

  test('running twice changes nothing the second time', async () => {
    h.state.queue = { u1: [queued()] };
    h.state.prefs = { u1: [{ id: 'p1', [PERK_REMINDER_FIELD]: true }] };
    await migrate(ctx());
    h.writes.deleted = [];
    h.writes.updated = [];

    const result = await migrate(ctx());

    expect(result).toMatchObject({ withdrawn: 0, cleared: 0 });
    expect(h.writes.deleted).toHaveLength(0);
    expect(h.writes.updated).toHaveLength(0);
  });

  test('a household that never opted in is a clean no-op', async () => {
    expect(await migrate(ctx())).toMatchObject({ withdrawn: 0, cleared: 0 });
  });
});
