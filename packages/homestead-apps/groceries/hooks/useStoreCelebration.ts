/**
 * Detects the moment a store's shopping is finished — its group transitioning
 * from "some items unchecked" to "every item checked" — and holds a short-lived
 * celebration state for the overlay to render.
 *
 * Transition-based on purpose: a store that is *already* fully checked when the
 * list first loads (or when a new group appears) says nothing about what the
 * shopper just did, so only a store seen incomplete on the previous pass
 * triggers. A group vanishing (Mark Complete deletes its items) is likewise
 * silent — the confirm dialog already owns that moment.
 */

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@rambleraptor/homestead-core/shared/hooks/useReducedMotion';
import type { StoreGroupedGroceries } from '../types';

/**
 * How long the overlay stays mounted. The CSS twin is the 2600ms
 * `celebration-card` animation in `globals.css` — the card has finished fading
 * before the unmount lands, so the removal is never visible.
 */
export const STORE_CELEBRATION_MS = 2800;
/**
 * With motion off the card is static text, so it only needs to hang around
 * long enough to be read.
 */
export const STORE_CELEBRATION_REDUCED_MS = 1600;

export interface StoreCelebration {
  /** Changes on every trigger so a re-celebration remounts (and replays) the overlay. */
  key: number;
  storeName: string;
}

interface GroupSnapshot {
  checked: number;
  total: number;
}

export function useStoreCelebration(storeGroups: StoreGroupedGroceries[]): StoreCelebration | null {
  const [celebration, setCelebration] = useState<StoreCelebration | null>(null);
  const prevRef = useRef<Map<string | null, GroupSnapshot> | null>(null);
  const reducedMotion = useReducedMotion();

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
    }
  }, [storeGroups]);

  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(
      () => setCelebration(null),
      reducedMotion ? STORE_CELEBRATION_REDUCED_MS : STORE_CELEBRATION_MS,
    );
    return () => clearTimeout(timer);
  }, [celebration, reducedMotion]);

  return celebration;
}
