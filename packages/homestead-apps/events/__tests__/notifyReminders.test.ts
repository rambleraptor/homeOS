/**
 * Unit tests for the reminder delivery crons.
 *
 * The engine client and the cross-user send helper are mocked, so what's under
 * test is the handler's own logic: the window each firing covers, who a reminder
 * is addressed to, and the dedup against notifications already recorded.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { CronContext } from '@rambleraptor/homestead-core/apps/types';

interface Row {
  [k: string]: unknown;
}

const h = vi.hoisted(() => {
  const state = {
    reminders: [] as Row[],
    users: [] as Row[],
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
            collection: () => ({
              listAll: async () => state.priorByUser[userId] ?? [],
            }),
          }),
        };
      }
      if (name === 'reminders') return { listAll: async () => state.reminders };
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

import {
  createReminderNotifier,
  recipientsFor,
  windowEnd,
} from '../crons/notifyReminders';
import type { Reminder } from '../types';

/** 2026-06-15, a Monday. */
const MORNING = new Date(2026, 5, 15, 9, 0, 0);
const EVENING = new Date(2026, 5, 15, 18, 0, 0);

function ctx(firedAt: Date): CronContext {
  return {
    id: 'reminders-notify',
    appId: 'events',
    token: 'admin-token',
    firedAt: firedAt.toISOString(),
    log: async () => {},
  };
}

/** Local-time ISO at an offset from the 15th. */
const at = (dayOffset: number, hour: number, minute = 0) =>
  new Date(2026, 5, 15 + dayOffset, hour, minute).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  h.state.reminders = [];
  h.state.users = [{ id: 'u1' }, { id: 'u2' }];
  h.state.priorByUser = {};
});

/** The user ids a run notified, in send order. */
function notifiedUsers(): string[] {
  return h.sendMock.mock.calls.map((call) => call[1] as string);
}

/** The options object of the nth send. */
function sendOptions(n = 0): Record<string, unknown> {
  return h.sendMock.mock.calls[n][2] as Record<string, unknown>;
}

describe('windowEnd', () => {
  test('the morning run reaches the evening run', () => {
    expect(windowEnd('morning', MORNING)).toEqual(new Date(2026, 5, 15, 18, 0, 0));
  });

  test('the evening run reaches tomorrow morning', () => {
    expect(windowEnd('evening', EVENING)).toEqual(new Date(2026, 5, 16, 9, 0, 0));
  });

  test('a late catch-up still covers its own slot’s window', () => {
    // Server was down at 09:00 and the hook ran at 14:30 instead.
    expect(windowEnd('morning', new Date(2026, 5, 15, 14, 30))).toEqual(
      new Date(2026, 5, 15, 18, 0, 0),
    );
  });
});

describe('recipientsFor', () => {
  const users = ['u1', 'u2'];

  test('a household reminder reaches everyone', () => {
    expect(recipientsFor({ visibility: 'household' } as Reminder, users)).toEqual([
      'u1',
      'u2',
    ]);
  });

  test('a private reminder reaches only its owner', () => {
    expect(
      recipientsFor({ visibility: 'private', created_by: 'u2' } as Reminder, users),
    ).toEqual(['u2']);
  });

  test('a pathed created_by still resolves', () => {
    expect(
      recipientsFor(
        { visibility: 'private', created_by: 'users/u2' } as Reminder,
        users,
      ),
    ).toEqual(['u2']);
  });

  test('a private reminder with no owner reaches nobody', () => {
    expect(recipientsFor({ visibility: 'private' } as Reminder, users)).toEqual([]);
  });

  test('notify_users narrows a household reminder', () => {
    expect(
      recipientsFor(
        { visibility: 'household', notify_users: ['u2'] } as Reminder,
        users,
      ),
    ).toEqual(['u2']);
  });

  test('a departed user is dropped', () => {
    expect(
      recipientsFor(
        { visibility: 'household', notify_users: ['gone'] } as Reminder,
        users,
      ),
    ).toEqual(['u1', 'u2']);
  });
});

describe('reminder delivery', () => {
  test('the morning run sends what is due before the evening run', async () => {
    h.state.reminders = [
      { id: 'r1', title: 'Call the plumber', due_at: at(0, 11), status: 'pending' },
    ];
    const result = await createReminderNotifier('morning')(ctx(MORNING));
    expect(result).toMatchObject({ due: 1, sent: 2 });
    expect(notifiedUsers()).toEqual(['u1', 'u2']);
  });

  test('the morning run leaves tonight’s reminder to the evening run', async () => {
    h.state.reminders = [
      { id: 'r1', title: 'Bins out', due_at: at(0, 20), status: 'pending' },
    ];
    await createReminderNotifier('morning')(ctx(MORNING));
    expect(h.sendMock).not.toHaveBeenCalled();

    await createReminderNotifier('evening')(ctx(EVENING));
    expect(notifiedUsers()).toEqual(['u1', 'u2']);
  });

  test('the evening run reaches into tomorrow morning', async () => {
    h.state.reminders = [
      { id: 'r1', title: 'Bin collection', due_at: at(1, 7), status: 'pending' },
    ];
    await createReminderNotifier('evening')(ctx(EVENING));
    expect(notifiedUsers()).toEqual(['u1', 'u2']);
  });

  test('a done reminder is never announced', async () => {
    h.state.reminders = [
      { id: 'r1', title: 'Call the plumber', due_at: at(0, 11), status: 'done' },
    ];
    await createReminderNotifier('morning')(ctx(MORNING));
    expect(h.sendMock).not.toHaveBeenCalled();
  });

  test('a recently overdue reminder is still announced', async () => {
    h.state.reminders = [
      { id: 'r1', title: 'Call the plumber', due_at: at(-2, 9), status: 'pending' },
    ];
    const result = await createReminderNotifier('morning')(ctx(MORNING));
    expect(result).toMatchObject({ due: 1, sent: 2 });
  });

  test('a long-stale reminder has stopped shouting', async () => {
    h.state.reminders = [
      { id: 'r1', title: 'Call the plumber', due_at: at(-30, 9), status: 'pending' },
    ];
    const result = await createReminderNotifier('morning')(ctx(MORNING));
    expect(result).toMatchObject({ due: 0, sent: 0 });
  });

  test('a reminder already recorded for a user is not re-sent to them', async () => {
    h.state.reminders = [
      { id: 'r1', title: 'Call the plumber', due_at: at(0, 11), status: 'pending' },
    ];
    h.state.priorByUser = { u1: [{ source_id: 'r1', scheduled_for: at(0, 11) }] };
    const result = await createReminderNotifier('morning')(ctx(MORNING));
    expect(result).toMatchObject({ sent: 1, skipped: 1 });
    expect(notifiedUsers()).toEqual(['u2']);
  });

  test('a moved due date is announced again', async () => {
    h.state.reminders = [
      { id: 'r1', title: 'Call the plumber', due_at: at(0, 11), status: 'pending' },
    ];
    h.state.priorByUser = { u1: [{ source_id: 'r1', scheduled_for: at(-1, 11) }] };
    const result = await createReminderNotifier('morning')(ctx(MORNING));
    expect(result).toMatchObject({ sent: 2, skipped: 0 });
  });

  test('notes become the notification body, and the row is stamped for dedup', async () => {
    h.state.users = [{ id: 'u1' }];
    h.state.reminders = [
      {
        id: 'r1',
        title: 'Bins out tonight: Trash',
        notes: 'Trash is collected tomorrow, Tuesday, June 16.',
        due_at: at(0, 18),
        status: 'pending',
        type: 'home',
      },
    ];
    await createReminderNotifier('evening')(ctx(EVENING));
    expect(sendOptions()).toMatchObject({
      title: 'Bins out tonight: Trash',
      body: 'Trash is collected tomorrow, Tuesday, June 16.',
      sourceCollection: 'reminders',
      sourceId: 'r1',
      notificationType: 'reminder',
      scheduledFor: at(0, 18),
    });
  });

  test('a reminder with no notes falls back to restating when it is due', async () => {
    h.state.users = [{ id: 'u1' }];
    h.state.reminders = [
      { id: 'r1', title: 'Call the plumber', due_at: at(0, 11), status: 'pending' },
    ];
    await createReminderNotifier('morning')(ctx(MORNING));
    expect(sendOptions().body).toMatch(/^Due Today, /);
  });

  test('an unknown app type still deep-links to the reminders tab', async () => {
    h.state.users = [{ id: 'u1' }];
    h.state.reminders = [
      {
        id: 'r1',
        title: 'Something',
        due_at: at(0, 11),
        status: 'pending',
        type: 'not-installed-here',
      },
    ];
    await createReminderNotifier('morning')(ctx(MORNING));
    expect(sendOptions().url).toBe('/events?tab=reminders');
  });

  test('a failed push is counted, not swallowed as sent', async () => {
    h.state.users = [{ id: 'u1' }];
    h.state.reminders = [
      { id: 'r1', title: 'Call the plumber', due_at: at(0, 11), status: 'pending' },
    ];
    h.sendMock.mockResolvedValueOnce(new Response('nope', { status: 500 }));
    const result = await createReminderNotifier('morning')(ctx(MORNING));
    expect(result).toMatchObject({ sent: 0, failed: 1 });
  });

  test('an unaddressable private reminder is reported rather than dropped quietly', async () => {
    h.state.reminders = [
      {
        id: 'r1',
        title: 'Buy her present',
        due_at: at(0, 11),
        status: 'pending',
        visibility: 'private',
      },
    ];
    const result = await createReminderNotifier('morning')(ctx(MORNING));
    expect(result).toMatchObject({ due: 1, sent: 0, unaddressed: 1 });
  });

  test('nothing due sends nothing at all', async () => {
    h.state.reminders = [
      { id: 'r1', title: 'Later', due_at: at(5, 9), status: 'pending' },
    ];
    const result = await createReminderNotifier('morning')(ctx(MORNING));
    expect(result).toMatchObject({ due: 0, sent: 0 });
    expect(h.sendMock).not.toHaveBeenCalled();
  });
});
