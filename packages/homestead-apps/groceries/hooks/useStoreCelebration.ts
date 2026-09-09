/**
 * Detects the moment a store's shopping is finished — its group transitioning
 * from "some items unchecked" to "every item checked" — tells the caller which
 * store it was (so it can raise the shared celebration toast), and holds a
 * short-lived state for the confetti overlay to render.
 *
 * Transition-based on purpose: a store that is *already* fully checked when the
 * list first loads (or when a new group appears) says nothing about what the
 * shopper just did, so only a store seen incomplete on the previous pass
 * triggers. A group vanishing (Clear sweeps its last crossed-off items away)
 * is likewise silent — the shopper just asked for that, nothing to applaud.
 */

import { useEffect, useRef, useState } from 'react';
import type { StoreGroupedGroceries } from '../types';

/**
 * How long the confetti overlay stays mounted. Every piece has landed by then
 * (`makeConfetti` in `StoreConfetti` caps delay + duration under this), so the
 * unmount is never visible. The toast runs on its own clock.
 */
export const STORE_CELEBRATION_MS = 2800;

export interface StoreCelebration {
  /** Changes on every trigger so a re-celebration remounts (and replays) the overlay. */
  key: number;
  storeName: string;
}

interface GroupSnapshot {
  checked: number;
  total: number;
}

export function useStoreCelebration(
  storeGroups: StoreGroupedGroceries[],
  /** Called once per trigger with the finished store's display name. */
  onCelebrate?: (storeName: string) => void,
): StoreCelebration | null {
  const [celebration, setCelebration] = useState<StoreCelebration | null>(null);
  const prevRef = useRef<Map<string | null, GroupSnapshot> | null>(null);
  // Read at trigger time through a ref: callers hand in an inline closure, and
  // making it a dependency would re-run the detection pass on every render.
  const onCelebrateRef = useRef(onCelebrate);
  useEffect(() => {
    onCelebrateRef.current = onCelebrate;
  }, [onCelebrate]);

  useEffect(() => {
    const prev = prevRef.current;
    const next = new Map<string | null, GroupSnapshot>();
    let completedStore: string | null = null;

    for (const group of storeGroups) {
      const id = group.store?.id ?? null;
      next.set(id, { checked: group.checkedCount, total: group.totalCount });

      const before = prev?.get(id);
      if (!before) continue; // first pass, or a group that just appeared
      const isComplete = group.totalCount > 0 && group.checkedCount === group.totalCount;
      const wasComplete = before.total > 0 && before.checked === before.total;
      if (isComplete && !wasComplete) {
        completedStore = group.store?.name ?? 'No Store';
      }
    }

    prevRef.current = next;
    if (completedStore !== null) {
      setCelebration({ key: Date.now(), storeName: completedStore });
      onCelebrateRef.current?.(completedStore);
    }
  }, [storeGroups]);

  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(() => setCelebration(null), STORE_CELEBRATION_MS);
    return () => clearTimeout(timer);
  }, [celebration]);

  return celebration;
}
