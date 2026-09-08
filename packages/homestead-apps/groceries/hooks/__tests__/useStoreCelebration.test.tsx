import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useStoreCelebration,
  STORE_CELEBRATION_MS,
} from '../useStoreCelebration';
import type { StoreGroupedGroceries } from '../../types';

function group(
  id: string | null,
  name: string,
  checkedCount: number,
  totalCount: number,
): StoreGroupedGroceries {
  return {
    store: id
      ? {
          id,
          name,
          created: '2026-04-26T00:00:00Z',
          updated: '2026-04-26T00:00:00Z',
        }
      : null,
    // The hook only reads the counts; rows aren't needed for these tests.
    items: [],
    checkedCount,
    totalCount,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useStoreCelebration', () => {
  it('does not celebrate a store that is already complete on first render', () => {
    const { result } = renderHook(({ groups }) => useStoreCelebration(groups), {
      initialProps: { groups: [group('s1', 'Aldi', 2, 2)] },
    });

    expect(result.current).toBeNull();
  });

  it('celebrates when a store transitions from incomplete to complete', () => {
    const { result, rerender } = renderHook(
      ({ groups }) => useStoreCelebration(groups),
      { initialProps: { groups: [group('s1', 'Aldi', 1, 2)] } },
    );
    expect(result.current).toBeNull();

    rerender({ groups: [group('s1', 'Aldi', 2, 2)] });

    expect(result.current?.storeName).toBe('Aldi');
  });

  it('celebrates the "No Store" group under its display name', () => {
    const { result, rerender } = renderHook(
      ({ groups }) => useStoreCelebration(groups),
      { initialProps: { groups: [group(null, '', 0, 1)] } },
    );

    rerender({ groups: [group(null, '', 1, 1)] });

    expect(result.current?.storeName).toBe('No Store');
  });

  it('auto-dismisses after the celebration window', () => {
    const { result, rerender } = renderHook(
      ({ groups }) => useStoreCelebration(groups),
      { initialProps: { groups: [group('s1', 'Aldi', 1, 2)] } },
    );
    rerender({ groups: [group('s1', 'Aldi', 2, 2)] });
    expect(result.current).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(STORE_CELEBRATION_MS);
    });

    expect(result.current).toBeNull();
  });

  it('stays quiet when a complete store disappears (Mark Complete)', () => {
    const { result, rerender } = renderHook(
      ({ groups }) => useStoreCelebration(groups),
      { initialProps: { groups: [group('s1', 'Aldi', 2, 2)] } },
    );

    rerender({ groups: [] });

    expect(result.current).toBeNull();
  });

  it('stays quiet when a new store appears already complete', () => {
    const { result, rerender } = renderHook(
      ({ groups }) => useStoreCelebration(groups),
      { initialProps: { groups: [group('s1', 'Aldi', 1, 2)] } },
    );

    rerender({
      groups: [group('s1', 'Aldi', 1, 2), group('s2', 'Costco', 3, 3)],
    });

    expect(result.current).toBeNull();
  });

  it('does not re-celebrate a store that stays complete across renders', () => {
    const { result, rerender } = renderHook(
      ({ groups }) => useStoreCelebration(groups),
      { initialProps: { groups: [group('s1', 'Aldi', 1, 2)] } },
    );
    rerender({ groups: [group('s1', 'Aldi', 2, 2)] });
    expect(result.current).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(STORE_CELEBRATION_MS);
    });
    expect(result.current).toBeNull();

    rerender({ groups: [group('s1', 'Aldi', 2, 2)] });

    expect(result.current).toBeNull();
  });

  it('celebrates again after items are unchecked and re-checked', () => {
    const { result, rerender } = renderHook(
      ({ groups }) => useStoreCelebration(groups),
      { initialProps: { groups: [group('s1', 'Aldi', 1, 2)] } },
    );
    rerender({ groups: [group('s1', 'Aldi', 2, 2)] });
    act(() => {
      vi.advanceTimersByTime(STORE_CELEBRATION_MS);
    });
    expect(result.current).toBeNull();

    rerender({ groups: [group('s1', 'Aldi', 1, 2)] });
    rerender({ groups: [group('s1', 'Aldi', 2, 2)] });

    expect(result.current?.storeName).toBe('Aldi');
  });

  it('tells the caller which store was just finished', () => {
    const onCelebrate = vi.fn();
    const { rerender } = renderHook(
      ({ groups }) => useStoreCelebration(groups, onCelebrate),
      { initialProps: { groups: [group('s1', 'Aldi', 1, 2)] } },
    );
    expect(onCelebrate).not.toHaveBeenCalled();

    rerender({ groups: [group('s1', 'Aldi', 2, 2)] });

    expect(onCelebrate).toHaveBeenCalledTimes(1);
    expect(onCelebrate).toHaveBeenCalledWith('Aldi');
  });

  it('fires the callback once per finish, even when a fresh closure is passed each render', () => {
    const calls: string[] = [];
    const { rerender } = renderHook(
      ({ groups }) => useStoreCelebration(groups, (name) => calls.push(name)),
      { initialProps: { groups: [group('s1', 'Aldi', 1, 2)] } },
    );

    rerender({ groups: [group('s1', 'Aldi', 2, 2)] });
    rerender({ groups: [group('s1', 'Aldi', 2, 2)] });
    act(() => {
      vi.advanceTimersByTime(STORE_CELEBRATION_MS);
    });
    rerender({ groups: [group('s1', 'Aldi', 2, 2)] });

    expect(calls).toEqual(['Aldi']);
  });
});
