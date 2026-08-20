/**
 * Tests for the standalone-reminder date helpers.
 *
 * Everything here is local-timezone arithmetic, so assertions compare against
 * locally-constructed `Date`s rather than hard-coded ISO strings — the suite
 * has to pass wherever CI happens to be running.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_HOUR,
  formatDueAt,
  fromDueAt,
  isOverdue,
  toDueAt,
} from '../reminderDate';

describe('toDueAt', () => {
  it('uses the supplied time', () => {
    expect(toDueAt('2026-03-04', '14:30')).toBe(
      new Date(2026, 2, 4, 14, 30).toISOString(),
    );
  });

  it('falls back to the default hour when no time is given', () => {
    expect(toDueAt('2026-03-04')).toBe(
      new Date(2026, 2, 4, DEFAULT_HOUR, 0).toISOString(),
    );
    expect(toDueAt('2026-03-04', '')).toBe(
      new Date(2026, 2, 4, DEFAULT_HOUR, 0).toISOString(),
    );
  });

  it('rejects a missing or malformed date', () => {
    expect(toDueAt('')).toBeNull();
    expect(toDueAt('04/03/2026')).toBeNull();
    expect(toDueAt('2026-3-4')).toBeNull();
  });

  it('rejects a day that does not exist rather than rolling it over', () => {
    // `new Date(2026, 1, 31)` silently becomes March 3 — storing a day the
    // user never picked is worse than refusing the input.
    expect(toDueAt('2026-02-31')).toBeNull();
    expect(toDueAt('2026-04-31')).toBeNull();
  });

  it('rejects an out-of-range time', () => {
    expect(toDueAt('2026-03-04', '25:00')).toBeNull();
    expect(toDueAt('2026-03-04', '12:99')).toBeNull();
  });
});

describe('fromDueAt', () => {
  it('round-trips through toDueAt', () => {
    const iso = toDueAt('2026-03-04', '14:30')!;
    expect(fromDueAt(iso)).toEqual({ date: '2026-03-04', time: '14:30' });
  });

  it('zero-pads single-digit months, days, hours, and minutes', () => {
    const iso = toDueAt('2026-01-02', '03:04')!;
    expect(fromDueAt(iso)).toEqual({ date: '2026-01-02', time: '03:04' });
  });

  it('returns empty controls for a missing or unparseable value', () => {
    expect(fromDueAt(undefined)).toEqual({ date: '', time: '' });
    expect(fromDueAt('not-a-date')).toEqual({ date: '', time: '' });
  });
});

describe('isOverdue', () => {
  const now = new Date(2026, 2, 4, 12, 0);

  it('is true for an instant in the past', () => {
    expect(isOverdue(new Date(2026, 2, 4, 11, 59).toISOString(), now)).toBe(true);
  });

  it('is false for an instant in the future', () => {
    expect(isOverdue(new Date(2026, 2, 4, 12, 1).toISOString(), now)).toBe(false);
  });

  it('is false for an unparseable value', () => {
    expect(isOverdue('not-a-date', now)).toBe(false);
  });
});

describe('formatDueAt', () => {
  const now = new Date(2026, 2, 4, 12, 0);

  it('says Today for the same calendar day, whatever the hour', () => {
    expect(formatDueAt(new Date(2026, 2, 4, 9, 0).toISOString(), now)).toMatch(
      /^Today, /,
    );
    expect(formatDueAt(new Date(2026, 2, 4, 23, 30).toISOString(), now)).toMatch(
      /^Today, /,
    );
  });

  it('says Tomorrow and Yesterday for the adjacent days', () => {
    expect(formatDueAt(new Date(2026, 2, 5, 8, 0).toISOString(), now)).toMatch(
      /^Tomorrow, /,
    );
    expect(formatDueAt(new Date(2026, 2, 3, 8, 0).toISOString(), now)).toMatch(
      /^Yesterday, /,
    );
  });

  it('uses a bare date within the current year', () => {
    const label = formatDueAt(new Date(2026, 5, 12, 9, 0).toISOString(), now);
    expect(label).toContain('Jun 12');
    expect(label).not.toContain('2026');
  });

  it('includes the year once it differs from now', () => {
    expect(formatDueAt(new Date(2027, 5, 12, 9, 0).toISOString(), now)).toContain(
      '2027',
    );
  });

  it('returns an empty string for an unparseable value', () => {
    expect(formatDueAt('not-a-date', now)).toBe('');
  });
});
