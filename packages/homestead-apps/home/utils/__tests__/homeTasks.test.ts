/**
 * Interval arithmetic and the labels the upkeep list reads off it. The month
 * clamping and the "counted from completion, not from the due date" rule are
 * the two places a schedule can quietly drift, so both are pinned here.
 */

import { describe, expect, it } from 'vitest';
import {
  addInterval,
  byDueDate,
  dueLabel,
  intervalLabel,
  nextDueAfterCompletion,
  toIsoDate,
  urgencyOf,
} from '../homeTasks';
import type { HomeTask } from '../../types';

const task = (over: Partial<HomeTask> = {}): HomeTask => ({
  id: 't1',
  name: 'Replace furnace filter',
  interval_count: 3,
  interval_unit: 'month',
  next_due: '2026-09-10',
  ...over,
});

const TODAY = '2026-09-07';

describe('toIsoDate', () => {
  it('formats a local date without drifting a day', () => {
    expect(toIsoDate(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(toIsoDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('addInterval', () => {
  it('adds days and weeks', () => {
    expect(addInterval('2026-09-07', 3, 'day')).toBe('2026-09-10');
    expect(addInterval('2026-09-07', 2, 'week')).toBe('2026-09-21');
  });

  it('adds months and years', () => {
    expect(addInterval('2026-09-07', 3, 'month')).toBe('2026-12-07');
    expect(addInterval('2026-09-07', 4, 'month')).toBe('2027-01-07');
    expect(addInterval('2026-09-07', 1, 'year')).toBe('2027-09-07');
  });

  it('clamps to the last day rather than overflowing into the next month', () => {
    // "3 months from January 31st" is April 30th, not May 1st.
    expect(addInterval('2026-01-31', 3, 'month')).toBe('2026-04-30');
    expect(addInterval('2026-01-31', 1, 'month')).toBe('2026-02-28');
    expect(addInterval('2024-01-31', 1, 'month')).toBe('2024-02-29');
  });

  it('crosses a leap day cleanly on a yearly step', () => {
    expect(addInterval('2024-02-29', 1, 'year')).toBe('2025-02-28');
  });

  it('returns null for an unusable date or interval', () => {
    expect(addInterval('not-a-date', 1, 'month')).toBeNull();
    expect(addInterval('2026-02-30', 1, 'month')).toBeNull();
    expect(addInterval('2026-09-07', 0, 'month')).toBeNull();
    expect(addInterval('2026-09-07', 1.5, 'month')).toBeNull();
  });
});

describe('nextDueAfterCompletion', () => {
  it('counts from the day it was done, not the day it was due', () => {
    // Due the 10th, actually done the 25th — the next one is three months
    // from the 25th, so a filter changed late still lasts its full life.
    expect(nextDueAfterCompletion(task(), '2026-09-25')).toBe('2026-12-25');
  });

  it('keeps the stored due date when the interval cannot be applied', () => {
    const broken = task({ interval_count: 0 });
    expect(nextDueAfterCompletion(broken, '2026-09-25')).toBe('2026-09-10');
  });
});

describe('intervalLabel', () => {
  it('reads as a cadence, not an equation', () => {
    expect(intervalLabel(1, 'day')).toBe('Daily');
    expect(intervalLabel(1, 'week')).toBe('Weekly');
    expect(intervalLabel(1, 'month')).toBe('Monthly');
    expect(intervalLabel(1, 'year')).toBe('Yearly');
    expect(intervalLabel(3, 'month')).toBe('Every 3 months');
    expect(intervalLabel(2, 'week')).toBe('Every 2 weeks');
  });
});

describe('urgencyOf', () => {
  it('classifies by how far off the due date is', () => {
    expect(urgencyOf(task({ next_due: '2026-09-01' }), TODAY)).toBe('overdue');
    expect(urgencyOf(task({ next_due: TODAY }), TODAY)).toBe('due-today');
    expect(urgencyOf(task({ next_due: '2026-09-14' }), TODAY)).toBe('due-soon');
    expect(urgencyOf(task({ next_due: '2026-12-01' }), TODAY)).toBe('scheduled');
  });

  it('reports a paused task as paused, however overdue it is', () => {
    expect(urgencyOf(task({ next_due: '2020-01-01', paused: true }), TODAY)).toBe('paused');
  });
});

describe('dueLabel', () => {
  it('says how late or how soon in plain words', () => {
    expect(dueLabel(task({ next_due: '2026-09-06' }), TODAY)).toBe('1 day overdue');
    expect(dueLabel(task({ next_due: '2026-09-01' }), TODAY)).toBe('6 days overdue');
    expect(dueLabel(task({ next_due: TODAY }), TODAY)).toBe('Due today');
    expect(dueLabel(task({ next_due: '2026-09-08' }), TODAY)).toBe('Due tomorrow');
    expect(dueLabel(task({ next_due: '2026-09-12' }), TODAY)).toBe('Due in 5 days');
    expect(dueLabel(task({ next_due: '2026-12-01' }), TODAY)).toMatch(/^Due /);
  });

  it('degrades rather than rendering blank for an unusable date', () => {
    expect(dueLabel(task({ next_due: 'whenever' }), TODAY)).toBe('No due date');
  });
});

describe('byDueDate', () => {
  it('sorts soonest first, paused last, ties by name', () => {
    const rows = [
      task({ id: 'c', name: 'Flush water heater', next_due: '2026-12-01' }),
      task({ id: 'p', name: 'Test sump pump', next_due: '2020-01-01', paused: true }),
      task({ id: 'a', name: 'Clean gutters', next_due: '2026-09-01' }),
      task({ id: 'b', name: 'Change filter', next_due: '2026-09-01' }),
    ];
    expect([...rows].sort(byDueDate).map((r) => r.id)).toEqual(['b', 'a', 'c', 'p']);
  });
});
