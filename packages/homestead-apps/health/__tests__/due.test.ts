import { describe, expect, it } from 'vitest';
import { DUE_SOON_DAYS, daysUntil, dueSoon, dueStatus, todayIso } from '../utils/due';
import type { Vaccination } from '../types';

const TODAY = '2026-08-31';

function makeVaccination(id: string, nextDue?: string): Vaccination {
  return {
    id,
    path: `vaccinations/${id}`,
    vaccine: `Vaccine ${id}`,
    date_administered: '2026-01-01',
    next_due: nextDue,
    create_time: '2026-01-01T00:00:00Z',
    update_time: '2026-01-01T00:00:00Z',
  };
}

describe('daysUntil', () => {
  it('counts whole days between ISO dates', () => {
    expect(daysUntil('2026-09-01', TODAY)).toBe(1);
    expect(daysUntil('2026-08-31', TODAY)).toBe(0);
    expect(daysUntil('2026-08-30', TODAY)).toBe(-1);
  });

  it('spans month and year boundaries', () => {
    expect(daysUntil('2027-08-31', TODAY)).toBe(365);
  });

  it('returns null for an unparseable date', () => {
    expect(daysUntil('soon', TODAY)).toBeNull();
    expect(daysUntil('2026-09-01', 'not-a-date')).toBeNull();
  });
});

describe('dueStatus', () => {
  it('is none without a due date', () => {
    expect(dueStatus(undefined, TODAY)).toBe('none');
    expect(dueStatus('', TODAY)).toBe('none');
  });

  it('is none for an unparseable due date', () => {
    expect(dueStatus('whenever', TODAY)).toBe('none');
  });

  it('is overdue for a past date', () => {
    expect(dueStatus('2026-08-30', TODAY)).toBe('overdue');
  });

  it('is due-soon from today through the window edge', () => {
    expect(dueStatus(TODAY, TODAY)).toBe('due-soon');
    expect(dueStatus('2026-10-30', TODAY)).toBe('due-soon'); // exactly DUE_SOON_DAYS out
  });

  it('is ok past the window', () => {
    expect(dueStatus('2026-10-31', TODAY)).toBe('ok'); // DUE_SOON_DAYS + 1
    expect(DUE_SOON_DAYS).toBe(60);
  });
});

describe('dueSoon', () => {
  it('keeps only overdue and due-soon records, soonest first', () => {
    const records = [
      makeVaccination('far', '2027-01-01'),
      makeVaccination('soon', '2026-09-15'),
      makeVaccination('past', '2026-08-01'),
      makeVaccination('never'),
    ];
    expect(dueSoon(records, TODAY).map((v) => v.id)).toEqual(['past', 'soon']);
  });

  it('returns an empty array when nothing is due', () => {
    expect(dueSoon([makeVaccination('a'), makeVaccination('b', '2027-06-01')], TODAY)).toEqual([]);
  });
});

describe('todayIso', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(todayIso(new Date(2026, 7, 31, 23, 59))).toBe('2026-08-31');
    expect(todayIso(new Date(2026, 0, 2, 0, 1))).toBe('2026-01-02');
  });
});
