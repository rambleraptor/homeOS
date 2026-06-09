import { describe, expect, it } from 'vitest';
import {
  APP_VISIBILITY_OPTIONS,
  formatTagList,
  parseTagList,
} from '../visibility';

describe('APP_VISIBILITY_OPTIONS', () => {
  it("includes the 'tagged' option", () => {
    expect(APP_VISIBILITY_OPTIONS).toContain('tagged');
  });
});

describe('parseTagList', () => {
  it('returns an empty array for empty / nullish input', () => {
    expect(parseTagList(undefined)).toEqual([]);
    expect(parseTagList(null)).toEqual([]);
    expect(parseTagList('')).toEqual([]);
  });

  it('splits on commas and trims whitespace', () => {
    expect(parseTagList('beta, early-access ,kitchen')).toEqual([
      'beta',
      'early-access',
      'kitchen',
    ]);
  });

  it('drops empty tokens and dedupes', () => {
    expect(parseTagList('beta,,beta, ,kitchen')).toEqual(['beta', 'kitchen']);
  });
});

describe('formatTagList', () => {
  it('joins tags with a comma', () => {
    expect(formatTagList(['beta', 'kitchen'])).toBe('beta,kitchen');
  });

  it('drops empty / whitespace entries and dedupes', () => {
    expect(formatTagList(['beta', '', '  ', 'beta', 'kitchen'])).toBe(
      'beta,kitchen',
    );
  });

  it('round-trips through parseTagList', () => {
    const tags = ['beta', 'kitchen', 'early-access'];
    expect(parseTagList(formatTagList(tags))).toEqual(tags);
  });
});
