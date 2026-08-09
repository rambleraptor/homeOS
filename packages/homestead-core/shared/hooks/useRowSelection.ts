/**
 * Row selection for list views — a `Set` of selected ids plus the toggles a
 * checkbox list needs. App-agnostic: any list that renders identifiable rows can
 * drive a "select some, then act on them" flow (bulk export is the first
 * consumer).
 *
 * The hook keeps its own selection state; the caller passes the *currently
 * visible* rows (already filtered/sorted) so "select all" and the all/none
 * header state track what the user can actually see. Ids that scroll out of view
 * (e.g. a filter change) stay selected but simply don't render.
 */

import { useCallback, useMemo, useState } from 'react';

export interface RowSelection {
  /** The selected ids, order-independent. */
  selectedIds: string[];
  /** How many rows are selected. */
  count: number;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  set: (id: string, selected: boolean) => void;
  clear: () => void;
  /**
   * Whether every currently-visible row is selected (false when there are no
   * visible rows) — drives the header checkbox's checked state.
   */
  allVisibleSelected: boolean;
  /** Some but not all visible rows selected — the header's indeterminate state. */
  someVisibleSelected: boolean;
  /** Select every visible row, or clear them, leaving off-view selections alone. */
  toggleAllVisible: () => void;
}

/**
 * @param visibleIds ids of the rows currently rendered (post-filter). Used only
 * to compute the header all/some state and to drive `toggleAllVisible`.
 */
export function useRowSelection(visibleIds: string[]): RowSelection {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const set = useCallback((id: string, on: boolean) => {
    setSelected((prev) => {
      if (prev.has(id) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someVisibleSelected =
    !allVisibleSelected && visibleIds.some((id) => selected.has(id));

  const toggleAllVisible = useCallback(() => {
    setSelected((prev) => {
      const everySelected =
        visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (everySelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }, [visibleIds]);

  const selectedIds = useMemo(() => [...selected], [selected]);

  return {
    selectedIds,
    count: selected.size,
    isSelected: useCallback((id: string) => selected.has(id), [selected]),
    toggle,
    set,
    clear,
    allVisibleSelected,
    someVisibleSelected,
    toggleAllVisible,
  };
}
