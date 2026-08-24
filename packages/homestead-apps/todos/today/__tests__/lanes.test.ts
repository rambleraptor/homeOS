/**
 * Unit tests for the Today lane builders.
 *
 * `now` is passed in everywhere, so these assert real calendar behaviour rather
 * than whatever day the suite happens to run on.
 */

import { describe, expect, it } from 'vitest';
import {
  buildEventItems,
  buildGroceryItems,
  buildPerkItems,
  buildPickupItems,
  buildReminderItems,
  buildTodoItems,
  relativeDayLabel,
  sortTodayItems,
} from '../lanes';
import type { TodayItem } from '../types';

/** Mid-afternoon, so "today" has hours on either side of it. */
const NOW = new Date(2026, 7, 24, 14, 0, 0); // 24 Aug 2026, local

const at = (dayOffset: number, hour = 9): Date =>
  new Date(2026, 7, 24 + dayOffset, hour, 0, 0);

describe('relativeDayLabel', () => {
  it('reads as the tail of a sentence', () => {
    expect(relativeDayLabel(0)).toBe('today');
    expect(relativeDayLabel(1)).toBe('tomorrow');
    expect(relativeDayLabel(4)).toBe('in 4 days');
  });
});

describe('buildReminderItems', () => {
  const row = (over: Record<string, unknown> = {}) =>
    ({
      id: 'r1',
      title: 'Call the vet',
      message: '',
      send_at: at(0).toISOString(),
      status: 'scheduled',
      ...over,
    }) as never;

  it("keeps a person's reminder scheduled for today", () => {
    const items = buildReminderItems([row()], NOW);
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe('Call the vet');
    expect(items[0]!.urgency).toBe('now');
  });

  it('drops app-raised rows, which have their own lane', () => {
    // A bin-night notification would otherwise say the same thing twice.
    expect(buildReminderItems([row({ source_app: 'home' })], NOW)).toHaveLength(0);
  });

  it('drops rows for another day, and ones already sent or cancelled', () => {
    expect(buildReminderItems([row({ send_at: at(1).toISOString() })], NOW)).toHaveLength(0);
    expect(buildReminderItems([row({ status: 'sent' })], NOW)).toHaveLength(0);
    expect(buildReminderItems([row({ status: 'canceled' })], NOW)).toHaveLength(0);
  });

  it('ignores an unparseable send_at rather than throwing', () => {
    expect(buildReminderItems([row({ send_at: 'not-a-date' })], NOW)).toHaveLength(0);
  });
});

describe('buildEventItems', () => {
  const event = (over: Record<string, unknown> = {}) => ({
    id: 'e1',
    name: "Marcus's birthday",
    names: ['Marcus'],
    tag: 'birthday',
    date: at(0),
    ...over,
  }) as never;

  it('titles a birthday with the person, not the record name', () => {
    const items = buildEventItems([event()], NOW);
    expect(items[0]!.title).toBe('Marcus');
    expect(items[0]!.detail).toBe('birthday today');
  });

  it('includes tomorrow, so there is time to act', () => {
    const items = buildEventItems([event({ date: at(1) })], NOW);
    expect(items[0]!.detail).toBe('birthday tomorrow');
  });

  it('excludes anything further out or already past', () => {
    expect(buildEventItems([event({ date: at(2) })], NOW)).toHaveLength(0);
    expect(buildEventItems([event({ date: at(-1) })], NOW)).toHaveLength(0);
  });

  it('falls back to the event name when no people are linked', () => {
    const items = buildEventItems([event({ names: [], tag: undefined })], NOW);
    expect(items[0]!.title).toBe("Marcus's birthday");
    expect(items[0]!.detail).toBe('event today');
  });

  it('joins several people conversationally', () => {
    const items = buildEventItems(
      [event({ names: ['Dana', 'Ray'], tag: 'anniversary' })],
      NOW,
    );
    expect(items[0]!.title).toBe('Dana & Ray');
  });
});

describe('buildPickupItems', () => {
  const day = (over: Record<string, unknown> = {}) => ({
    date: '2026-08-25',
    daysAway: 1,
    delayed: false,
    pickups: [{ stream: 'garbage' }, { stream: 'recyclable' }],
    ...over,
  }) as never;

  it('prompts for tonight when collection is tomorrow', () => {
    const items = buildPickupItems([day()], NOW);
    expect(items[0]!.title).toBe('Trash & Recycling go out tonight');
    expect(items[0]!.detail).toContain('Collection tomorrow');
  });

  it('reports rather than prompts when collection is today', () => {
    const items = buildPickupItems([day({ daysAway: 0, date: '2026-08-24' })], NOW);
    expect(items[0]!.title).toBe('Trash & Recycling collected today');
  });

  it('carries the holiday note through', () => {
    const items = buildPickupItems(
      [day({ delayed: true, pickups: [{ stream: 'garbage', note: 'Labor Day — 1 day delay' }] })],
      NOW,
    );
    expect(items[0]!.detail).toContain('Labor Day');
  });

  it('collapses a repeated stream to one label', () => {
    const items = buildPickupItems(
      [day({ pickups: [{ stream: 'garbage' }, { stream: 'garbage' }] })],
      NOW,
    );
    expect(items[0]!.title).toBe('Trash go out tonight');
  });

  it('ignores days beyond tomorrow', () => {
    expect(buildPickupItems([day({ daysAway: 3 })], NOW)).toHaveLength(0);
  });
});

describe('buildPerkItems', () => {
  const perk = (id: string, value: number, endOffset: number, isRedeemed = false) =>
    ({
      perk: { id, name: 'dining credit', value },
      card: { name: 'Amex Platinum' },
      currentPeriod: { start: at(-20), end: at(endOffset) },
      isRedeemed,
    }) as never;

  it('surfaces an unredeemed perk closing inside the urgency window', () => {
    const items = buildPerkItems([perk('p1', 50, 4)], NOW);
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe('$50.00 dining credit');
    expect(items[0]!.detail).toBe('Amex Platinum · expires in 4 days');
    expect(items[0]!.urgency).toBe('soon');
  });

  it('never nags about a perk already used', () => {
    expect(buildPerkItems([perk('p1', 50, 4, true)], NOW)).toHaveLength(0);
  });

  it('stays quiet outside the urgency window', () => {
    expect(buildPerkItems([perk('p1', 50, 20)], NOW)).toHaveLength(0);
  });

  it('caps at the two most valuable, so the card cannot be flooded', () => {
    const items = buildPerkItems(
      [perk('p1', 10, 2), perk('p2', 200, 3), perk('p3', 75, 1)],
      NOW,
    );
    expect(items.map((i) => i.title)).toEqual([
      '$200.00 dining credit',
      '$75.00 dining credit',
    ]);
  });
});

describe('buildGroceryItems', () => {
  const stores = [
    { id: 's1', name: 'Costco' },
    { id: 's2', name: 'H-E-B' },
  ] as never;

  it('counts only what is still unchecked', () => {
    const items = buildGroceryItems(
      [
        { id: 'g1', checked: false, store: 's1' },
        { id: 'g2', checked: true, store: 's1' },
      ] as never,
      stores,
    );
    expect(items[0]!.title).toBe('1 item to pick up');
  });

  it('breaks the count down once more than one store is involved', () => {
    const items = buildGroceryItems(
      [
        { id: 'g1', checked: false, store: 's1' },
        { id: 'g2', checked: false, store: 's1' },
        { id: 'g3', checked: false, store: 's2' },
      ] as never,
      stores,
    );
    expect(items[0]!.title).toBe('3 items to pick up');
    expect(items[0]!.detail).toBe('2 at Costco, 1 at H-E-B');
  });

  it('omits a breakdown that would only restate the count', () => {
    const items = buildGroceryItems(
      [{ id: 'g1', checked: false, store: 's1' }] as never,
      stores,
    );
    expect(items[0]!.detail).toBeUndefined();
  });

  it('says nothing at all when the list is clear', () => {
    expect(buildGroceryItems([{ id: 'g1', checked: true }] as never, stores)).toHaveLength(0);
  });
});

describe('buildTodoItems', () => {
  it('counts pending work across both lists', () => {
    const items = buildTodoItems(
      [{ status: 'pending' }, { status: 'completed' }, { status: 'do_later' }] as never,
      [{ status: 'pending' }] as never,
    );
    expect(items[0]!.title).toBe('2 open todos');
    expect(items[0]!.detail).toBe('1 shared · 1 personal');
  });

  it('drops the breakdown when only one list has work', () => {
    const items = buildTodoItems([{ status: 'pending' }] as never, []);
    expect(items[0]!.title).toBe('1 open todo');
    expect(items[0]!.detail).toBeUndefined();
  });

  it('says nothing when everything is done', () => {
    expect(buildTodoItems([{ status: 'completed' }] as never, [])).toHaveLength(0);
  });
});

describe('sortTodayItems', () => {
  it('orders by urgency, then by time, with untimed lines last in a band', () => {
    const item = (id: string, urgency: TodayItem['urgency'], ms?: number): TodayItem => ({
      id,
      lane: 'reminder',
      title: id,
      href: '/',
      urgency,
      at: ms,
    });

    const sorted = sortTodayItems([
      item('ambient', 'ambient'),
      item('soon', 'soon', 500),
      item('now-late', 'now', 200),
      item('now-untimed', 'now'),
      item('now-early', 'now', 100),
    ]);

    expect(sorted.map((i) => i.id)).toEqual([
      'now-early',
      'now-late',
      'now-untimed',
      'soon',
      'ambient',
    ]);
  });
});
