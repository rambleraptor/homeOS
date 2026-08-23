/**
 * Unit tests for the `credit-cards-perk-reminders` cron handler.
 *
 * The engine client is mocked with an in-memory three-level store (cards →
 * perks → redemptions) plus a per-user notification queue that records writes,
 * so what is under test is the handler's real logic: computing a window it has
 * no stored date for, deciding what counts as unredeemed, grouping a card's
 * closing perks into one digest, and — the one that matters most here — not
 * nagging daily.
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
    cards: [] as Row[],
    perksByCard: {} as Record<string, Row[]>,
    redemptionsByPerk: {} as Record<string, Row[]>,
    /** The delivery queue, per user — `/users/{id}/scheduled-notifications`. */
    queue: {} as Record<string, Row[]>,
    nextId: 1,
  };
  const writes = {
    created: [] as Array<Row & { userId: string }>,
    updated: [] as Array<{ id: string; patch: Row }>,
    deleted: [] as string[],
  };
  const queueFor = (userId: string) => ({
    listAll: async () => state.queue[userId] ?? [],
    create: async (payload: Row) => {
      const row = { id: `new-${state.nextId++}`, ...payload };
      (state.queue[userId] ??= []).push(row);
      writes.created.push({ ...row, userId });
      return row;
    },
    record: (id: string) => ({
      update: async (patch: Row) => {
        writes.updated.push({ id, patch });
        const row = (state.queue[userId] ?? []).find((r) => r.id === id);
        if (row) Object.assign(row, patch);
        return row;
      },
      delete: async () => {
        writes.deleted.push(id);
        state.queue[userId] = (state.queue[userId] ?? []).filter((r) => r.id !== id);
      },
    }),
  });
  const fakeHs = {
    collection: (name: string) => {
      if (name === 'users') {
        return {
          listAll: async () => state.users,
          record: (userId: string) => ({ collection: () => queueFor(userId) }),
        };
      }
      if (name === 'credit-cards') {
        return {
          listAll: async () => state.cards,
          record: (cardId: string) => ({
            collection: () => ({
              listAll: async () => state.perksByCard[cardId] ?? [],
              record: (perkId: string) => ({
                collection: () => ({
                  listAll: async () => state.redemptionsByPerk[perkId] ?? [],
                }),
              }),
            }),
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
vi.mock('@rambleraptor/homestead-core/server/user-settings', () => ({
  usersWithFlag: async (_token: string, userIds: readonly string[]) =>
    userIds.filter((id) => h.state.optedIn.includes(id)),
}));

import handler, {
  MIN_REMAINING_VALUE,
  buildContent,
  redeemedForPeriod,
  windowOpensAt,
} from '../crons/perk-reminders';
import { getCurrentPeriod } from '../utils/periodUtils';
import type { CreditCard, PerkPeriod } from '../types';

/** A calendar-year card, so periods land on clean month boundaries. */
const CARD = {
  id: 'c1',
  name: 'Platinum',
  issuer: 'Amex',
  annual_fee: 695,
  anniversary_date: '2020-03-15T00:00:00.000Z',
  reset_mode: 'calendar_year',
};

/** Run the cron at a given local instant. */
function ctx(at: Date): CronContext {
  return {
    id: 'credit-cards-perk-reminders',
    appId: 'credit-cards',
    token: 'admin-token',
    firedAt: at.toISOString(),
    log: async () => {},
  };
}

/** A monthly perk's window closes on the last day of the month. */
const MONTH_END = new Date(2026, 5, 30); // June 30 2026

beforeEach(() => {
  h.state.users = [{ id: 'u1' }, { id: 'u2' }];
  h.state.optedIn = ['u1'];
  h.state.cards = [CARD];
  h.state.perksByCard = {};
  h.state.redemptionsByPerk = {};
  h.state.queue = {};
  h.state.nextId = 1;
  h.writes.created = [];
  h.writes.updated = [];
  h.writes.deleted = [];
});

describe('windowOpensAt', () => {
  test('a monthly perk gets a few days, an annual one gets a month', () => {
    const period: PerkPeriod = { start: new Date(2026, 5, 1), end: MONTH_END };
    expect(windowOpensAt(period, 'monthly')).toEqual(new Date(2026, 5, 26, 9));
    expect(windowOpensAt(period, 'quarterly')).toEqual(new Date(2026, 5, 23, 9));
    expect(windowOpensAt(period, 'annual')).toEqual(new Date(2026, 4, 31, 9));
  });

  test('the moment is derived from the period, never from the clock', () => {
    const period: PerkPeriod = { start: new Date(2026, 5, 1), end: MONTH_END };
    // Same answer whenever you ask — this is what stops a daily re-notify.
    expect(windowOpensAt(period, 'monthly')).toEqual(
      windowOpensAt({ ...period }, 'monthly'),
    );
  });
});

describe('redeemedForPeriod', () => {
  const period: PerkPeriod = { start: new Date(2026, 5, 1), end: MONTH_END };
  const exact = {
    perk: 'p1',
    period_start: '2026-06-01T00:00:00Z',
    period_end: '2026-06-30T00:00:00Z',
  };

  test('counts an exactly-matching redemption', () => {
    expect(
      redeemedForPeriod([{ ...exact, amount: 20 }] as never, 'p1', period),
    ).toBe(20);
  });

  test('still counts one whose stored boundaries are a day off', () => {
    // The timezone skew case: written client-local in another zone, so the
    // stored boundary slices to the neighbouring day and the strict match misses.
    expect(
      redeemedForPeriod(
        [
          {
            perk: 'p1',
            period_start: '2026-05-31T11:00:00Z',
            period_end: '2026-06-29T11:00:00Z',
            amount: 20,
          },
        ] as never,
        'p1',
        period,
      ),
    ).toBe(20);
  });

  test('does not double-count a redemption both readings find', () => {
    expect(
      redeemedForPeriod([{ ...exact, amount: 20 }] as never, 'p1', period),
    ).toBe(20);
  });

  test('ignores another period and another perk', () => {
    expect(
      redeemedForPeriod(
        [
          {
            perk: 'p1',
            period_start: '2026-05-01T00:00:00Z',
            period_end: '2026-05-31T00:00:00Z',
            amount: 99,
          },
          {
            perk: 'other',
            period_start: '2026-06-01T00:00:00Z',
            period_end: '2026-06-30T00:00:00Z',
            amount: 99,
          },
        ] as never,
        'p1',
        period,
      ),
    ).toBe(0);
  });
});

describe('buildContent', () => {
  const period: PerkPeriod = { start: new Date(2026, 5, 1), end: MONTH_END };

  test('one perk reads as a sentence', () => {
    expect(
      buildContent(CARD as unknown as CreditCard, [
        { perk: { name: 'Dining credit', value: 50 }, period, remaining: 50 },
      ] as never, period),
    ).toEqual({
      title: 'Dining credit closes June 30',
      notes: '$50 unclaimed on your Platinum. The window closes June 30.',
    });
  });

  test('several perks become one itemised digest', () => {
    const { title, notes } = buildContent(
      CARD as unknown as CreditCard,
      [
        { perk: { name: 'Dining credit', value: 50 }, period, remaining: 50 },
        { perk: { name: 'Streaming credit', value: 20 }, period, remaining: 12.5 },
      ] as never,
      period,
    );
    expect(title).toBe('2 credits close June 30 on Platinum');
    expect(notes).toContain('$62.50 unclaimed before June 30');
    expect(notes).toContain('• Dining credit — $50 left');
    expect(notes).toContain('• Streaming credit — $12.50 left');
  });
});

describe('perk window reminders', () => {
  /** Fire on the day a monthly window opens: June 26, lead 4. */
  const OPENS = new Date(2026, 5, 26, 3, 0, 0);

  function monthlyPerk(over: Row = {}): Row {
    return {
      id: 'p1',
      credit_card: 'c1',
      name: 'Dining credit',
      value: 50,
      frequency: 'monthly',
      ...over,
    };
  }

  test('an unused perk becomes one queued notification when its window opens', async () => {
    h.state.perksByCard = { c1: [monthlyPerk()] };

    const result = await handler(ctx(OPENS));

    expect(result).toMatchObject({ optedIn: 1, planned: 1, created: 1 });
    expect(h.writes.created[0]).toMatchObject({
      userId: 'u1',
      title: 'Dining credit closes June 30',
      send_at: new Date(2026, 5, 26, 9).toISOString(),
      url: '/credit-cards',
      source_app: 'credit-cards',
      source_key: 'perk-window:c1:2026-06-30:monthly',
      status: 'scheduled',
    });
  });

  test('nothing is written before the window opens', async () => {
    h.state.perksByCard = { c1: [monthlyPerk()] };
    // June 20 — six days out, past the 3-day horizon on a 4-day lead.
    const result = await handler(ctx(new Date(2026, 5, 20, 3)));
    expect(result).toMatchObject({ planned: 0, created: 0 });
  });

  test('running again the next day changes nothing — no daily nag', async () => {
    h.state.perksByCard = { c1: [monthlyPerk()] };
    await handler(ctx(OPENS));
    h.writes.created = [];

    const day2 = await handler(ctx(new Date(2026, 5, 27, 3)));
    const day3 = await handler(ctx(new Date(2026, 5, 28, 3)));

    expect(day2).toMatchObject({ created: 0, updated: 0, unchanged: 1 });
    expect(day3).toMatchObject({ created: 0, updated: 0, unchanged: 1 });
    expect(h.writes.created).toHaveLength(0);
    expect(h.writes.updated).toHaveLength(0);
  });

  test('a fully redeemed perk is left alone', async () => {
    h.state.perksByCard = { c1: [monthlyPerk()] };
    const period = getCurrentPeriod('monthly', 'calendar_year', CARD.anniversary_date, OPENS);
    h.state.redemptionsByPerk = {
      p1: [
        {
          period_start: period.start.toISOString(),
          period_end: period.end.toISOString(),
          amount: 50,
        },
      ],
    };

    const result = await handler(ctx(OPENS));
    expect(result).toMatchObject({ planned: 0 });
  });

  test('a partly redeemed perk still counts — that money is on the table', async () => {
    h.state.perksByCard = { c1: [monthlyPerk({ value: 200 })] };
    const period = getCurrentPeriod('monthly', 'calendar_year', CARD.anniversary_date, OPENS);
    // Deliberately unlike the perks list, which sorts `partial` as done.
    h.state.redemptionsByPerk = {
      p1: [
        {
          period_start: period.start.toISOString(),
          period_end: period.end.toISOString(),
          amount: 50,
        },
      ],
    };

    const result = await handler(ctx(OPENS));
    expect(result).toMatchObject({ planned: 1 });
    expect(h.writes.created[0].message).toContain('$150 unclaimed');
  });

  test('a trivial leftover is not worth interrupting anyone', async () => {
    h.state.perksByCard = { c1: [monthlyPerk({ value: MIN_REMAINING_VALUE - 1 })] };
    const result = await handler(ctx(OPENS));
    expect(result).toMatchObject({ planned: 0 });
  });

  test('small credits closing together clear the floor as a group', async () => {
    h.state.perksByCard = {
      c1: [
        monthlyPerk({ id: 'p1', name: 'Coffee credit', value: 6 }),
        monthlyPerk({ id: 'p2', name: 'Streaming credit', value: 6 }),
      ],
    };
    const result = await handler(ctx(OPENS));
    expect(result).toMatchObject({ planned: 1 });
    expect(h.writes.created[0].title).toBe('2 credits close June 30 on Platinum');
  });

  test('one card’s perks closing together are one interruption', async () => {
    h.state.perksByCard = {
      c1: [
        monthlyPerk({ id: 'p1', name: 'Dining credit', value: 50 }),
        monthlyPerk({ id: 'p2', name: 'Streaming credit', value: 20 }),
      ],
    };

    const result = await handler(ctx(OPENS));

    expect(result).toMatchObject({ created: 1 });
    expect(h.writes.created[0].message).toContain('• Dining credit');
    expect(h.writes.created[0].message).toContain('• Streaming credit');
  });

  test('an archived card is skipped entirely', async () => {
    h.state.cards = [{ ...CARD, archived: true }];
    h.state.perksByCard = { c1: [monthlyPerk()] };
    const result = await handler(ctx(OPENS));
    expect(result).toMatchObject({ planned: 0, perks: 0 });
  });

  test('nobody opted in means nothing is written', async () => {
    h.state.optedIn = [];
    h.state.perksByCard = { c1: [monthlyPerk()] };
    const result = await handler(ctx(OPENS));
    expect(result).toMatchObject({ planned: 0, created: 0 });
  });

  test('opting out withdraws a notification that has not fired yet', async () => {
    h.state.perksByCard = { c1: [monthlyPerk()] };
    // Just inside the 3-day horizon, so the row exists but is still in the
    // future — which is what makes it withdrawable rather than historical.
    const early = new Date(2026, 5, 23, 10);
    await handler(ctx(early));
    expect(h.state.queue.u1).toHaveLength(1);

    h.state.optedIn = [];
    const result = await handler(ctx(early));
    expect(result).toMatchObject({ withdrawn: 1 });
    expect(h.state.queue.u1).toHaveLength(0);
  });

  test('another app’s notifications are never touched', async () => {
    h.state.queue = {
      u1: [
        {
          id: 'bin',
          title: 'Bins out tonight: Trash',
          send_at: new Date(2026, 5, 27, 18).toISOString(),
          status: 'scheduled',
          source_app: 'home',
          source_key: 'pickup:2026-06-28',
        },
      ],
    };
    h.state.perksByCard = {};

    const result = await handler(ctx(OPENS));
    expect(result).toMatchObject({ withdrawn: 0, pruned: 0 });
    expect(h.writes.deleted).toHaveLength(0);
  });

  test('redemptions are only fetched for perks in play', async () => {
    h.state.perksByCard = {
      c1: [
        monthlyPerk({ id: 'p1' }),
        // Annual: its window opens 30 days before Dec 31, nowhere near June.
        monthlyPerk({ id: 'p2', frequency: 'annual', value: 300 }),
      ],
    };

    const result = await handler(ctx(OPENS));

    // 1 (users) + 1 (cards) + 1 (perks) + 1 (redemptions for p1 only)
    expect(result).toMatchObject({ perks: 2, requests: 4, planned: 1 });
  });
});
