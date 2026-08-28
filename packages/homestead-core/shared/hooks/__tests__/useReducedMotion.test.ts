/**
 * The hook exists so JavaScript that *waits* on an animation can skip the wait
 * for readers who asked not to see one. Getting it wrong is invisible in the
 * common case and costs those readers a delay they explicitly opted out of, so
 * both directions are checked, plus the environment where `matchMedia` is
 * missing entirely.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReducedMotion } from '../useReducedMotion';

const original = window.matchMedia;

/** Install a matchMedia whose `matches` can be flipped mid-test. */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const list = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue(list),
  });
  return {
    set(next: boolean) {
      list.matches = next;
      listeners.forEach((fn) => fn());
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', { writable: true, value: original });
});

describe('useReducedMotion', () => {
  it('is false when the reader has expressed no preference', () => {
    stubMatchMedia(false);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
  });

  it('is true when reduced motion is requested', () => {
    stubMatchMedia(true);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(true);
  });

  it('follows the setting changing mid-session', () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => media.set(true));
    expect(result.current).toBe(true);
  });

  it('unsubscribes on unmount', () => {
    const media = stubMatchMedia(false);
    const { unmount } = renderHook(() => useReducedMotion());
    expect(media.listenerCount).toBe(1);

    unmount();
    expect(media.listenerCount).toBe(0);
  });

  it('assumes motion is fine where matchMedia does not exist', () => {
    Object.defineProperty(window, 'matchMedia', { writable: true, value: undefined });
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
  });
});
