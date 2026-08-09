/**
 * Unit tests for the `events-notify` cron handler.
 *
 * The engine client and the cross-user send helper are mocked, so the test
 * exercises the handler's real logic: bucketing events into day-of / week-out,
 * fanning out to each user's per-event reminders, honoring the lead, and
 * deduping against notifications already recorded.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { nextOccurrence } from '../utils/eventDate';
import type { CronContext } from '@rambleraptor/homestead-core/apps/types';

interface Row {
  [k: string]: unknown;
}

// Hoisted so the vi.mock factories (which run before module imports) can close
// over live state the tests mutate in beforeEach.
const h = vi.hoisted(() => {
  const state = {
    events: [] as Row[],
    users: [] as Row[],
    remindersByUser: {} as Record<string, Row[]>,
    priorByUser: {} as Record<string, Row[]>,
  };
  const sendMock = vi.fn(
    async () => new Response(JSON.stringify({ success: true }), { status: 200 }),
  );
  const fakeHs = {
    collection: (name: string) => {
      if (name === 'users') {
        return {
          listAll: async () => state.users,
          record: (userId: string) => ({
            collection: (child: string) => ({
              listAll: async () =>
                child === 'event-reminders'
                  ? (state.remindersByUser[userId] ?? [])
                  : child === 'notifications'
                    ? (state.priorByUser[userId] ?? [])
                    : [],
            }),
          }),
        };
      }
      if (name === 'events') return { listAll: async () => state.events };
      return { listAll: async () => [] };
    },
  };
  return { state, sendMock, fakeHs };
});

vi.mock('@rambleraptor/homestead-core/server/client', () => ({
  serverClient: () => h.fakeHs,
}));
vi.mock('@rambleraptor/homestead-core/server/notifications', () => ({
  sendNotificationToUser: (...args: unknown[]) => h.sendMock(...args),
}));

import handler from '../crons/notify';

// Fixed clock: 2026-06-15 09:00 local. getNextEventOccurrence reads `new Date()`.
const NOW = new Date(2026, 5, 15, 9, 0, 0);

function ctx(): CronContext {
  return {
    id: 'events-notify',
    appId: 'events',
    token: 'admin-token',
    firedAt: NOW.toISOString(),
    log: async () => {},
  };
}

const occIso = (month: number, day: number) =>
  nextOccurrence({ month, day }).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  h.sendMock.mockClear();
  h.state.events = [
    // due today; birthday with a known year → age in the body
    { id: 'e-today', name: "Mom's Birthday", month: 6, day: 15, year: 1990, tag: 'birthday' },
    { id: 'e-week', name: 'Anniversary', month: 6, day: 22, tag: 'anniversary' }, // due in 7 days
    { id: 'e-far', name: 'Graduation', month: 12, day: 25 }, // neither
  ];
  h.state.users = [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }];
  h.state.remindersByUser = {
    u1: [{ id: 'r1', event_id: 'e-today', lead: 'day_of' }],
    u2: [{ id: 'r2', event_id: 'e-week', lead: 'week_before' }],
    u3: [
      { id: 'r3', event_id: 'e-today', lead: 'both' },
      { id: 'r4', event_id: 'e-far', lead: 'both' },
    ],
  };
  h.state.priorByUser = {};
});

afterEach(() => {
  vi.useRealTimers();
});

describe('events-notify handler', () => {
  test('sends the right lead to each user and ignores events out of window', async () => {
    const result = await handler(ctx());

    const calls = h.sendMock.mock.calls.map(([, userId, opts]) => ({
      userId,
      type: (opts as Row).notificationType,
      sourceId: (opts as Row).sourceId,
    }));

    // u1 → day_of for today's event; u2 → week_before for the +7 event;
    // u3 'both' on today's event yields only day_of (it's not in the week bucket),
    // and the far event yields nothing.
    expect(calls).toHaveLength(3);
    expect(calls).toEqual(
      expect.arrayContaining([
        { userId: 'u1', type: 'day_of', sourceId: 'e-today' },
        { userId: 'u2', type: 'week_before', sourceId: 'e-week' },
        { userId: 'u3', type: 'day_of', sourceId: 'e-today' },
      ]),
    );
    expect(result).toMatchObject({
      events: 3,
      dueDayOf: 1,
      dueWeekBefore: 1,
      sent: 3,
      skipped: 0,
      failed: 0,
    });
  });

  test('sets sourceCollection, scheduledFor, and a stable tag on each send', async () => {
    await handler(ctx());
    const [, , opts] = h.sendMock.mock.calls.find(
      ([, userId]) => userId === 'u2',
    )!;
    expect(opts).toMatchObject({
      sourceCollection: 'events',
      sourceId: 'e-week',
      notificationType: 'week_before',
      scheduledFor: occIso(6, 22),
      tag: 'event-e-week-week_before',
      url: '/events',
    });
  });

  test('includes the age in a birthday body when the year is known', async () => {
    await handler(ctx());
    // e-today is a birthday with year 1990; the 2026 occurrence → turning 36.
    const call = h.sendMock.mock.calls.find(
      ([, , opts]) => (opts as Row).sourceId === 'e-today',
    )!;
    expect((call[2] as Row).body).toContain('Turning 36');
  });

  test('skips an (event, lead, occurrence) already recorded in the inbox', async () => {
    h.state.priorByUser = {
      u1: [
        {
          source_id: 'e-today',
          notification_type: 'day_of',
          scheduled_for: occIso(6, 15),
        },
      ],
    };

    const result = await handler(ctx());
    const userIds = h.sendMock.mock.calls.map(([, userId]) => userId);

    expect(userIds).not.toContain('u1');
    expect(result).toMatchObject({ sent: 2, skipped: 1 });
  });

  test('no-ops when nothing is due', async () => {
    h.state.events = [{ id: 'e-far', name: 'Graduation', month: 12, day: 25 }];
    const result = await handler(ctx());
    expect(h.sendMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ events: 1, dueDayOf: 0, dueWeekBefore: 0, sent: 0 });
  });
});
