/**
 * Groceries module: thin shim over the generic offline mutation factory.
 *
 * Historically this file owned all create/update/delete defaults for grocery
 * items + stores. The logic is now generic and lives in
 * `@rambleraptor/homestead-core/api/registerResourceMutationDefaults`. This
 * file:
 *
 *  1. Re-exports `GroceryMutationKeys` (legacy keys) and the variable shapes
 *     that the existing hooks reference.
 *  2. Provides custom `buildOptimistic` + cascade behavior for groceries.
 *  3. Calls the generic factory under both the new singular-based keys
 *     (`create-grocery`, `update-grocery`, `delete-grocery`, `*-store`) and
 *     the legacy `*-item`/`*-store` keys, so any v1 persisted queue still
 *     replays after rollout.
 *
 * The auto-registration loop in `frontend/src/app/providers.tsx` calls
 * `registerResourceMutationDefaults` for every resource declared in
 * `groceries/resources.ts`. The overrides expressed in `module.config.ts`
 * (`offlineOverrides`) supply the grocery-specific bits (sort, cascade
 * delete, optimistic shape, legacy keys) — nothing else needs to live here.
 */

import type { QueryClient } from '@tanstack/react-query';
import {
  registerResourceMutationDefaults,
  newTempId as coreNewTempId,
  isTempId as coreIsTempId,
  clearTempIdMaps as coreClearTempIdMaps,
  TEMP_ID_PREFIX,
} from '@rambleraptor/homestead-core/api/registerResourceMutationDefaults';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { GROCERIES, STORES } from './resources';
import {
  applyItemSort,
  applyStoreSort,
  buildOptimisticGrocery,
  buildOptimisticStore,
  storeCascadeDelete,
} from './offline';
import type { GroceryItem, Store } from './types';

// ---- legacy mutation keys (referenced by the per-hook shells) -------------

export const GroceryMutationKeys = {
  createItem: ['module', 'groceries', 'create-item'] as const,
  updateItem: ['module', 'groceries', 'update-item'] as const,
  deleteItem: ['module', 'groceries', 'delete-item'] as const,
  createStore: ['module', 'groceries', 'create-store'] as const,
  updateStore: ['module', 'groceries', 'update-store'] as const,
  deleteStore: ['module', 'groceries', 'delete-store'] as const,
};

// ---- variable shapes (kept here so existing imports compile) --------------

export interface CreateItemVars {
  name: string;
  notes?: string;
  store?: string;
  tempId: string;
}

export interface UpdateItemVars {
  id: string;
  data: Partial<{ name: string; notes: string; checked: boolean; store: string }>;
}

export type DeleteItemVars = string;

export interface CreateStoreVars {
  name: string;
  sort_order?: number;
  tempId: string;
}

export interface UpdateStoreVars {
  id: string;
  data: Partial<Pick<Store, 'name' | 'sort_order'>>;
}

export type DeleteStoreVars = string;

// ---- temp-id helpers (re-export so tests + hooks keep their imports) ------

export { TEMP_ID_PREFIX };
export const newTempId = coreNewTempId;
export const isTempId = coreIsTempId;
export const clearTempIdMaps = coreClearTempIdMaps;

// ---- registration ---------------------------------------------------------

const ITEMS_KEY = queryKeys.module('groceries').list();
const STORES_KEY = queryKeys.module('groceries').detail('stores');

/**
 * Register grocery mutation defaults. Modern callers don't need to invoke
 * this directly — the auto-registration loop in `providers.tsx` walks every
 * module's resources and calls `registerResourceMutationDefaults` with the
 * overrides declared in `module.config.ts`. This wrapper exists so:
 *
 *  - existing tests (`__tests__/useCreateGroceryItem.test.ts` etc.) can keep
 *    `registerGroceryMutationDefaults(client)` as their setup call;
 *  - any v1 persisted queue using the legacy `*-item`/`*-store` mutation
 *    keys still finds defaults bound to those keys after rollout.
 */
export function registerGroceryMutationDefaults(qc: QueryClient): void {
  // grocery (item)
  registerResourceMutationDefaults<GroceryItem, CreateItemVars, UpdateItemVars['data']>(
    qc,
    {
      moduleId: 'groceries',
      singular: 'grocery',
      plural: GROCERIES,
      listQueryKey: ITEMS_KEY,
      buildOptimistic: buildOptimisticGrocery,
      sort: applyItemSort,
      toCreateBody: (vars) => ({
        name: vars.name,
        notes: vars.notes ?? '',
        store: vars.store ?? '',
        checked: false,
      }),
      legacyKeys: {
        create: GroceryMutationKeys.createItem,
        update: GroceryMutationKeys.updateItem,
        delete: GroceryMutationKeys.deleteItem,
      },
    },
  );

  // store
  registerResourceMutationDefaults<Store, CreateStoreVars, UpdateStoreVars['data']>(
    qc,
    {
      moduleId: 'groceries',
      singular: 'store',
      plural: STORES,
      listQueryKey: STORES_KEY,
      buildOptimistic: buildOptimisticStore,
      sort: applyStoreSort,
      toCreateBody: (vars) => ({
        name: vars.name,
        sort_order: vars.sort_order ?? 0,
      }),
      cascadeDelete: storeCascadeDelete,
      legacyKeys: {
        create: GroceryMutationKeys.createStore,
        update: GroceryMutationKeys.updateStore,
        delete: GroceryMutationKeys.deleteStore,
      },
    },
  );
}
