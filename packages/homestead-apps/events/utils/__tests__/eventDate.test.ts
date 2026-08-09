import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  eventAgeLabel,
  eventAnchorDate,
  hasEventDate,
  nextOccurrence,
} from '../eventDate';

describe('hasEventDate', () => {
  it('accepts a valid month/day', () => {
    expect(hasEventDate({ month: 6, day: 15 })).toBe(true);
  });
  it('rejects missing or out-of-range parts', () => {
    expect(hasEventDate({})).toBe(false);
    expect(hasEventDate({ month: 0, day: 15 })).toBe(false);
    expect(hasEventDate({ month: 13, day: 1 })).toBe(false);
    expect(hasEventDate({ month: 6, day: 32 })).toBe(false);
  });
});

describe('eventAnchorDate', () => {
  it('builds a date at the given month/day', () => {
    const d = eventAnchorDate({ month: 6, day: 15 });
    expect(d.getMonth()).toBe(5); // 0-indexed June
    expect(d.getDate()).toBe(15);
  });
});

describe('nextOccurrence', () => {
  afterEach(() => vi.useRealTimers());

  it('returns this year when the date is still ahead', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1));
    const d = nextOccurrence({ month: 6, day: 15 });
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 5, 15]);
  });

  it('rolls to next year when the date has passed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 31));
    expect(nextOccurrence({ month: 6, day: 15 }).getFullYear()).toBe(2027);
  });
});

describe('eventAgeLabel', () => {
  it('returns null when no year is known', () => {
    expect(eventAgeLabel({ tag: 'birthday' }, 2026)).toBeNull();
  });
  it('formats a birthday as "Turning N"', () => {
    expect(eventAgeLabel({ tag: 'birthday', year: 1990 }, 2026)).toBe('Turning 36');
  });
  it('formats anniversaries and other tags as "N years"', () => {
    expect(eventAgeLabel({ tag: 'anniversary', year: 2000 }, 2026)).toBe('26 years');
    expect(eventAgeLabel({ tag: 'graduation', year: 2020 }, 2026)).toBe('6 years');
  });
  it('returns null for a future origin year', () => {
    expect(eventAgeLabel({ tag: 'birthday', year: 2030 }, 2026)).toBeNull();
  });
});
