/**
 * The pickup date logic. The cases that matter are timezone-shaped: a plain
 * `YYYY-MM-DD` must mean that calendar day for the viewer, never UTC midnight
 * read back a day early.
 */

import { describe, it, expect } from 'vitest';
import type { GarbagePickup } from '../../types';
import {
  daysBetween,
  parseIsoDate,
  relativeDayLabel,
  streamLabel,
  todayIso,
  upcomingPickupDays,
} from '../pickups';

const pickup = (
  id: string,
  pickup_date: string,
  stream: string,
  extra: Partial<GarbagePickup> = {},
): GarbagePickup =>
  ({ id, pickup_date, stream, ...extra }) as GarbagePickup;

describe('parseIsoDate', () => {
  it('parses to local midnight, not UTC', () => {
    const date = parseIsoDate('2026-08-17')!;
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7);
    expect(date.getDate()).toBe(17);
    expect(date.getHours()).toBe(0);
  });

  it('rejects malformed and overflowing dates', () => {
    expect(parseIsoDate('08-17-2026')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
    expect(parseIsoDate('2026-8-7')).toBeNull();
    // The Date constructor would roll this into March; we don't.
    expect(parseIsoDate('2026-02-30')).toBeNull();
  });
});

describe('todayIso', () => {
  it('formats the local calendar date, zero-padded', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('uses the local day even late at night, when UTC has already rolled over', () => {
    // 23:30 local is the next day in UTC anywhere east of ~UTC-0:30. The label
    // must still read as the local day.
    const local = new Date(2026, 7, 17, 23, 30);
    expect(todayIso(local)).toBe('2026-08-17');
  });
});

describe('daysBetween', () => {
  it('counts calendar days, including across a month boundary', () => {
    expect(daysBetween('2026-08-17', '2026-08-17')).toBe(0);
    expect(daysBetween('2026-08-31', '2026-09-01')).toBe(1);
    expect(daysBetween('2026-08-17', '2026-08-31')).toBe(14);
    expect(daysBetween('2026-08-18', '2026-08-17')).toBe(-1);
  });

  it('counts calendar days across a DST transition', () => {
    // US DST ends 2026-11-01; the interval is 25 hours of wall clock but one day.
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
  });

  it('returns null for unparseable input', () => {
    expect(daysBetween('nope', '2026-08-17')).toBeNull();
  });
});

describe('relativeDayLabel', () => {
  const now = new Date(2026, 7, 17); // Monday, Aug 17 2026

  it('names the near days', () => {
    expect(relativeDayLabel('2026-08-17', now)).toBe('Today');
    expect(relativeDayLabel('2026-08-18', now)).toBe('Tomorrow');
  });

  it('uses a weekday inside the week and a dated form beyond it', () => {
    expect(relativeDayLabel('2026-08-20', now)).toBe('Thursday');
    expect(relativeDayLabel('2026-08-31', now)).toMatch(/Aug/);
  });

  it('returns null for an unparseable date', () => {
    expect(relativeDayLabel('08-17-2026', now)).toBeNull();
  });
});

describe('streamLabel', () => {
  it('names the known streams', () => {
    expect(streamLabel('garbage')).toBe('Trash');
    expect(streamLabel('yard-waste')).toBe('Yard waste');
  });

  it('degrades readably for a stream it does not know', () => {
    expect(streamLabel('electronic-waste')).toBe('Electronic waste');
  });
});

describe('upcomingPickupDays', () => {
  const now = new Date(2026, 7, 17); // Monday, Aug 17 2026

  it('groups a day into one row and orders streams trash-first', () => {
    const days = upcomingPickupDays(
      [
        pickup('b', '2026-08-17', 'recyclable'),
        pickup('a', '2026-08-17', 'garbage'),
      ],
      { now },
    );

    expect(days).toHaveLength(1);
    expect(days[0]!.date).toBe('2026-08-17');
    expect(days[0]!.daysAway).toBe(0);
    expect(days[0]!.pickups.map((p) => p.stream)).toEqual([
      'garbage',
      'recyclable',
    ]);
  });

  it('sorts days soonest first', () => {
    const days = upcomingPickupDays(
      [
        pickup('c', '2026-08-31', 'recyclable'),
        pickup('a', '2026-08-24', 'garbage'),
      ],
      { now, days: 30 },
    );
    expect(days.map((d) => d.date)).toEqual(['2026-08-24', '2026-08-31']);
  });

  it('drops past pickups and ones past the lookahead window', () => {
    const days = upcomingPickupDays(
      [
        pickup('past', '2026-08-10', 'garbage'),
        pickup('now', '2026-08-17', 'garbage'),
        pickup('far', '2026-09-30', 'garbage'),
      ],
      { now, days: 14 },
    );
    expect(days.map((d) => d.date)).toEqual(['2026-08-17']);
  });

  it('keeps a pickup on the last day of the window', () => {
    const days = upcomingPickupDays([pickup('edge', '2026-08-31', 'garbage')], {
      now,
      days: 14,
    });
    expect(days.map((d) => d.date)).toEqual(['2026-08-31']);
  });

  it('drops rows with an unparseable or missing date rather than showing them', () => {
    const days = upcomingPickupDays(
      [
        pickup('bad', '08-17-2026', 'garbage'),
        { id: 'missing', stream: 'garbage' } as GarbagePickup,
      ],
      { now },
    );
    expect(days).toEqual([]);
  });

  it('marks a day delayed when any of its streams is', () => {
    const days = upcomingPickupDays(
      [
        pickup('a', '2026-08-17', 'garbage'),
        pickup('b', '2026-08-17', 'recyclable', {
          status: 'delayed',
          note: 'Holiday — 1 day delay',
        }),
      ],
      { now },
    );
    expect(days[0]!.delayed).toBe(true);
  });

  it('sorts an unknown stream last instead of dropping it', () => {
    const days = upcomingPickupDays(
      [
        pickup('x', '2026-08-17', 'electronic-waste'),
        pickup('a', '2026-08-17', 'garbage'),
      ],
      { now },
    );
    expect(days[0]!.pickups.map((p) => p.stream)).toEqual([
      'garbage',
      'electronic-waste',
    ]);
  });
});
