/**
 * Pure planning helpers for the bundle `split` method: page-range clamping,
 * ordering, tax-year parsing, and grouping-tag/filename derivation. The vision
 * call and the PDF cut aren't exercised here — only the logic that decides
 * where the boundaries land and how the pieces are labelled.
 */

import { describe, expect, it } from 'vitest';
import {
  childFilename,
  groupTag,
  normalizeTaxYear,
  planSegments,
  type DetectedSegment,
} from '../methods/split-plan';

describe('planSegments', () => {
  it('maps 1-based inclusive ranges to 0-based page indices', () => {
    const raw: DetectedSegment[] = [
      { start_page: 1, end_page: 2, title: 'W-2 — Acme' },
      { start_page: 3, end_page: 3, title: '1099-INT — Bank' },
    ];
    expect(planSegments(raw, 3)).toEqual([
      { startPage: 1, endPage: 2, pageIndices: [0, 1], title: 'W-2 — Acme' },
      { startPage: 3, endPage: 3, pageIndices: [2], title: '1099-INT — Bank' },
    ]);
  });

  it('sorts segments into page order', () => {
    const raw: DetectedSegment[] = [
      { start_page: 3, end_page: 4, title: 'B' },
      { start_page: 1, end_page: 2, title: 'A' },
    ];
    expect(planSegments(raw, 4).map((s) => s.title)).toEqual(['A', 'B']);
  });

  it('clamps out-of-range pages to the document bounds', () => {
    const raw: DetectedSegment[] = [{ start_page: 0, end_page: 99, title: 'X' }];
    const [seg] = planSegments(raw, 5);
    expect(seg).toMatchObject({ startPage: 1, endPage: 5, pageIndices: [0, 1, 2, 3, 4] });
  });

  it('rights a reversed range', () => {
    const [seg] = planSegments([{ start_page: 4, end_page: 2, title: 'R' }], 5);
    expect(seg).toMatchObject({ startPage: 2, endPage: 4, pageIndices: [1, 2, 3] });
  });

  it('drops non-numeric ranges rather than crashing the cut', () => {
    const raw = [
      { start_page: Number.NaN, end_page: 2, title: 'bad' },
      { start_page: 1, end_page: 1, title: 'ok' },
    ] as DetectedSegment[];
    expect(planSegments(raw, 3).map((s) => s.title)).toEqual(['ok']);
  });

  it('falls back to a page-range title when the model gave none', () => {
    expect(planSegments([{ start_page: 2, end_page: 3, title: null }], 3)[0].title).toBe(
      'Pages 2–3',
    );
    expect(planSegments([{ start_page: 1, end_page: 1, title: '  ' }], 3)[0].title).toBe(
      'Pages 1–1',
    );
  });

  it('returns nothing for an empty document', () => {
    expect(planSegments([{ start_page: 1, end_page: 1 }], 0)).toEqual([]);
  });

  it('preserves a single all-pages segment (the "not a bundle" signal)', () => {
    // The method treats a length < 2 result as "nothing to split".
    expect(planSegments([{ start_page: 1, end_page: 6, title: null }], 6)).toHaveLength(1);
  });
});

describe('normalizeTaxYear', () => {
  it('extracts a four-digit year from free text', () => {
    expect(normalizeTaxYear('2024')).toBe('2024');
    expect(normalizeTaxYear('Tax year 2023 return')).toBe('2023');
  });

  it('returns null when there is no year', () => {
    expect(normalizeTaxYear(null)).toBeNull();
    expect(normalizeTaxYear(undefined)).toBeNull();
    expect(normalizeTaxYear('n/a')).toBeNull();
    expect(normalizeTaxYear('')).toBeNull();
  });
});

describe('groupTag', () => {
  it('keys on the tax year when known', () => {
    expect(groupTag('2024')).toBe('tax-return-2024');
  });

  it('falls back to a generic bucket', () => {
    expect(groupTag(null)).toBe('tax-return');
  });
});

describe('childFilename', () => {
  it('slugs a title into a pdf filename', () => {
    expect(childFilename('1099-INT — Pecan Street Credit Union')).toBe(
      '1099-int-pecan-street-credit-union.pdf',
    );
  });

  it('falls back to a default when the title has no usable characters', () => {
    expect(childFilename('— —')).toBe('document.pdf');
  });
});
