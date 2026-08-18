/**
 * The classify-reveal trigger. Its whole job is telling a *transition* apart
 * from a *state*, so that's what these check: a document that resolves while
 * you're looking at it reveals, and one that was already parsed before it
 * rendered doesn't.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useJustParsed } from '../hooks/useJustParsed';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useJustParsed', () => {
  it('reveals when a document finishes reading', () => {
    const { result, rerender } = renderHook(({ status }) => useJustParsed(status), {
      initialProps: { status: 'pending' as const },
    });
    expect(result.current).toBe(false);

    rerender({ status: 'parsed' as never });
    expect(result.current).toBe(true);
  });

  it('stops revealing once the moment has passed', () => {
    const { result, rerender } = renderHook(({ status }) => useJustParsed(status), {
      initialProps: { status: 'pending' as const },
    });
    rerender({ status: 'parsed' as never });
    expect(result.current).toBe(true);

    act(() => void vi.advanceTimersByTime(2000));
    expect(result.current).toBe(false);
  });

  it('does not reveal a document that was already parsed when it mounted', () => {
    // Scrolling the list, opening a detail page, or a remount from a filter
    // change must not replay a classification that happened days ago.
    const { result } = renderHook(() => useJustParsed('parsed'));
    expect(result.current).toBe(false);
  });

  it('does not reveal on a re-render with no status change', () => {
    const { result, rerender } = renderHook(({ status }) => useJustParsed(status), {
      initialProps: { status: 'parsed' as const },
    });
    rerender({ status: 'parsed' });
    expect(result.current).toBe(false);
  });

  it('does not reveal when reading ends in a non-parsed outcome', () => {
    const { result, rerender } = renderHook(({ status }) => useJustParsed(status), {
      initialProps: { status: 'pending' as const },
    });
    rerender({ status: 'unmatched' as never });
    expect(result.current).toBe(false);

    rerender({ status: 'failed' as never });
    expect(result.current).toBe(false);
  });

  it('reveals again when a re-read resolves', () => {
    const { result, rerender } = renderHook(({ status }) => useJustParsed(status), {
      initialProps: { status: 'parsed' as const },
    });
    // "Read again with AI" puts it back to pending, then resolves.
    rerender({ status: 'pending' as never });
    expect(result.current).toBe(false);
    rerender({ status: 'parsed' as never });
    expect(result.current).toBe(true);
  });
});
