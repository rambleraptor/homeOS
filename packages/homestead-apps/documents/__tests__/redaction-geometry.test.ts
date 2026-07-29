/**
 * Redaction geometry — the DOM-free math behind the editor. The canvas
 * rasterization these feed (destroying pixels, PDF rebuild) needs a real canvas
 * and is covered by the e2e flow instead; here we pin the coordinate logic.
 */

import { describe, expect, it } from 'vitest';
import {
  clampRect,
  isDrawable,
  MIN_RECT_SIZE,
  rectFromPoints,
  toPixels,
  type PixelRect,
} from '../redaction/geometry';
import type { NormRect } from '../redaction/types';

function expectRectClose(actual: NormRect | PixelRect, expected: NormRect | PixelRect) {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
  expect(actual.w).toBeCloseTo(expected.w, 6);
  expect(actual.h).toBeCloseTo(expected.h, 6);
}

describe('rectFromPoints', () => {
  it('builds a positive rect regardless of drag direction', () => {
    const a = { x: 0.6, y: 0.7 };
    const b = { x: 0.2, y: 0.3 };
    expectRectClose(rectFromPoints(a, b), { x: 0.2, y: 0.3, w: 0.4, h: 0.4 });
    expectRectClose(rectFromPoints(b, a), rectFromPoints(a, b));
  });
});

describe('clampRect', () => {
  it('leaves an in-bounds rect unchanged', () => {
    expectRectClose(clampRect({ x: 0.1, y: 0.1, w: 0.2, h: 0.3 }), {
      x: 0.1,
      y: 0.1,
      w: 0.2,
      h: 0.3,
    });
  });

  it('trims a rect that overflows the far edges', () => {
    expectRectClose(clampRect({ x: 0.8, y: 0.9, w: 0.5, h: 0.5 }), {
      x: 0.8,
      y: 0.9,
      w: 0.2,
      h: 0.1,
    });
  });

  it('clamps a rect that starts off the top-left', () => {
    expectRectClose(clampRect({ x: -0.2, y: -0.1, w: 0.5, h: 0.4 }), {
      x: 0,
      y: 0,
      w: 0.3,
      h: 0.3,
    });
  });
});

describe('isDrawable', () => {
  it('rejects an accidental click (near-zero drag)', () => {
    expect(isDrawable({ x: 0.5, y: 0.5, w: 0, h: 0 })).toBe(false);
    expect(isDrawable({ x: 0.5, y: 0.5, w: MIN_RECT_SIZE / 2, h: 0.4 })).toBe(false);
  });

  it('accepts a deliberate drag', () => {
    expect(isDrawable({ x: 0.1, y: 0.1, w: 0.2, h: 0.2 })).toBe(true);
  });
});

describe('toPixels', () => {
  it('maps a normalized rect onto source pixels', () => {
    expect(toPixels({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 }, 800, 400)).toEqual({
      x: 200,
      y: 200,
      w: 400,
      h: 100,
    });
  });

  it('covers the whole page for a full-bleed rect', () => {
    expect(toPixels({ x: 0, y: 0, w: 1, h: 1 }, 640, 480)).toEqual({
      x: 0,
      y: 0,
      w: 640,
      h: 480,
    });
  });
});
