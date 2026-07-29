/**
 * Pure geometry helpers for the redaction editor — no DOM, so they're unit
 * tested directly (the canvas rasterization they feed is covered by e2e).
 */

import type { NormRect } from './types';

export interface Point {
  x: number;
  y: number;
}

/** Build a normalized rect from two corner points, in any drag direction. */
export function rectFromPoints(a: Point, b: Point): NormRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}

/** Clamp a normalized rect so it stays fully within the [0,1] page bounds. */
export function clampRect(r: NormRect): NormRect {
  const left = Math.min(Math.max(r.x, 0), 1);
  const top = Math.min(Math.max(r.y, 0), 1);
  const right = Math.min(Math.max(r.x + r.w, 0), 1);
  const bottom = Math.min(Math.max(r.y + r.h, 0), 1);
  return { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) };
}

/** A drag smaller than this on either axis is treated as an accidental click. */
export const MIN_RECT_SIZE = 0.01;

export function isDrawable(r: NormRect): boolean {
  return r.w >= MIN_RECT_SIZE && r.h >= MIN_RECT_SIZE;
}

export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Convert a normalized rect to integer pixel bounds on a width×height page. */
export function toPixels(r: NormRect, width: number, height: number): PixelRect {
  const x = Math.round(r.x * width);
  const y = Math.round(r.y * height);
  return {
    x,
    y,
    w: Math.round((r.x + r.w) * width) - x,
    h: Math.round((r.y + r.h) * height) - y,
  };
}
