/**
 * Groceries offline helpers — shapes specific to this module that the
 * generic `registerResourceMutationDefaults` factory wires in via overrides.
 */

import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import type {
  CreateItemVars,
  CreateStoreVars,
} from './registerMutationDefaults';
import type { GroceryItem, Store } from './types';

const ITEMS_KEY = queryKeys.module('groceries').list();

function nowIso(): string {
  return new Date().toISOString();
}

export function applyItemSort(items: GroceryItem[]): GroceryItem[] {
  return [...items].sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

export function applyStoreSort(stores: Store[]): Store[] {
  return [...stores].sort((a, b) => {
    const ao = a.sort_order ?? 0;
    const bo = b.sort_order ?? 0;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name);
  });
}

export function buildOptimisticGrocery(vars: CreateItemVars): GroceryItem {
  const ts = nowIso();
  return {
    id: vars.tempId,
    name: vars.name,
    notes: vars.notes ?? '',
    store: vars.store ?? '',
    checked: false,
    created: ts,
    updated: ts,
  };
}

export function buildOptimisticStore(vars: CreateStoreVars): Store {
  const ts = nowIso();
  return {
    id: vars.tempId,
    name: vars.name,
    sort_order: vars.sort_order ?? 0,
    created: ts,
    updated: ts,
  };
}

/**
 * When a store is deleted, items pointing at it reappear under "No Store"
 * (empty `store` field). The cascade is applied optimistically inside the
 * delete `onMutate` and rolled back on error.
 */
export const storeCascadeDelete = {
  apply(storeId: string, qc: QueryClient): unknown {
    const items = qc.getQueryData<GroceryItem[]>(ITEMS_KEY) ?? [];
    qc.setQueryData<GroceryItem[]>(
      ITEMS_KEY,
      applyItemSort(
        items.map((it) => (it.store === storeId ? { ...it, store: '' } : it)),
      ),
    );
    return items;
  },
  rollback(snapshot: unknown, qc: QueryClient): void {
    qc.setQueryData<GroceryItem[]>(ITEMS_KEY, snapshot as GroceryItem[]);
  },
};
