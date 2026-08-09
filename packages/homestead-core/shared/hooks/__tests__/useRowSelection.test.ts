import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRowSelection } from '../useRowSelection';

describe('useRowSelection', () => {
  it('toggles individual rows and reports the selection', () => {
    const { result } = renderHook(() => useRowSelection(['a', 'b', 'c']));

    act(() => result.current.toggle('a'));
    act(() => result.current.toggle('c'));

    expect(result.current.count).toBe(2);
    expect([...result.current.selectedIds].sort()).toEqual(['a', 'c']);
    expect(result.current.isSelected('a')).toBe(true);
    expect(result.current.isSelected('b')).toBe(false);
  });

  it('tracks all/some visible state and select-all toggles every visible row', () => {
    const { result } = renderHook(() => useRowSelection(['a', 'b']));

    act(() => result.current.set('a', true));
    expect(result.current.someVisibleSelected).toBe(true);
    expect(result.current.allVisibleSelected).toBe(false);

    act(() => result.current.toggleAllVisible());
    expect(result.current.allVisibleSelected).toBe(true);
    expect(result.current.count).toBe(2);

    act(() => result.current.toggleAllVisible());
    expect(result.current.count).toBe(0);
  });

  it('keeps off-view selections when selecting all visible rows', () => {
    // "hidden" was selected while visible; a later filtered view no longer lists
    // it, but select-all over the new view must not drop it.
    const { result, rerender } = renderHook(({ ids }) => useRowSelection(ids), {
      initialProps: { ids: ['hidden', 'a'] },
    });
    act(() => result.current.set('hidden', true));

    rerender({ ids: ['a', 'b'] });
    act(() => result.current.toggleAllVisible());

    expect([...result.current.selectedIds].sort()).toEqual(['a', 'b', 'hidden']);
  });

  it('clear() empties the selection', () => {
    const { result } = renderHook(() => useRowSelection(['a', 'b']));
    act(() => result.current.toggleAllVisible());
    act(() => result.current.clear());
    expect(result.current.count).toBe(0);
  });
});
