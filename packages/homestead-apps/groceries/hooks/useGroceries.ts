/**
 * Groceries list hook.
 */

import { useResourceList } from '@rambleraptor/homestead-core/api/resourceHooks';
import { useLiveRefresh } from '@rambleraptor/homestead-core/api/useLiveRefresh';
import { GROCERIES } from '../resources';
import type { GroceryItem } from '../types';

interface AepGroceryItem extends GroceryItem {
  path: string;
  create_time: string;
  update_time: string;
}

export function useGroceries() {
  // The list is shared, so a change made on another device has to arrive on
  // its own — see useLiveRefresh.
  const live = useLiveRefresh();

  return useResourceList<AepGroceryItem>('groceries', 'grocery', GROCERIES, {
    ...live,
    map: (rec) => ({
      ...rec,
      created: rec.create_time || '',
      updated: rec.update_time || '',
    }),
    sort: (a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      return a.name.localeCompare(b.name);
    },
    // Long enough to survive within the persister's 7-day maxAge window;
    // the global default of 10 minutes would let cache be GC'd before
    // hydration restores it on a cold offline reload.
    gcTime: 24 * 60 * 60 * 1000,
  });
}
