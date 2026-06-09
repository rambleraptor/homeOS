import { describe, it, expect } from 'vitest';
import {
  decomposeRemaining,
  tickIntervalMs,
} from '../utils/countdown';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

describe('decomposeRemaining', () => {
  it('rolls everything up into the only enabled unit', () => {
    const cells = decomposeRemaining(2 * DAY + 5 * HOUR, ['hours']);
    expect(cells).toEqual([{ unit: 'hours', value: 53 }]);
  });

  it('splits remaining across all enabled units', () => {
    const ms = 1 * MONTH + 2 * WEEK + 3 * DAY + 4 * HOUR + 5 * MINUTE + 6 * SECOND;
    const cells = decomposeRemaining(ms, [
      'months',
      'weeks',
      'days',
      'hours',
      'minutes',
      'seconds',
    ]);
    expect(cells).toEqual([
      { unit: 'months', value: 1 },
      { unit: 'weeks', value: 2 },
      { unit: 'days', value: 3 },
      { unit: 'hours', value: 4 },
      { unit: 'minutes', value: 5 },
      { unit: 'seconds', value: 6 },
    ]);
  });

  it('returns the units in canonical (largest-first) order regardless of input order', () => {
    const cells = decomposeRemaining(DAY + HOUR, ['hours', 'days']);
    expect(cells.map((c) => c.unit)).toEqual(['days', 'hours']);
  });

  it('clamps negative remaining time to zero across cells', () => {
    const cells = decomposeRemaining(-5 * DAY, ['days', 'hours']);
    expect(cells).toEqual([
      { unit: 'days', value: 0 },
      { unit: 'hours', value: 0 },
    ]);
  });
});

describe('tickIntervalMs', () => {
  it('ticks every second when seconds are enabled', () => {
    expect(tickIntervalMs(['days', 'seconds'])).toBe(1000);
  });

  it('ticks every minute when minutes are the finest unit', () => {
    expect(tickIntervalMs(['days', 'minutes'])).toBe(60 * 1000);
  });

  it('falls back to hourly when only coarse units are enabled', () => {
    expect(tickIntervalMs(['months', 'days'])).toBe(60 * 60 * 1000);
  });
});
