/**
 * Groceries Module Configuration
 *
 * Module for managing household grocery list with AI-powered categorization
 */

import type { HomeModule } from '@/modules/types';
import { ShoppingCart } from 'lucide-react';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { groceriesOmnibox } from './omnibox';
import { GroceriesWidget } from './components/GroceriesWidget';
import { GroceriesHome } from './components/GroceriesHome';
import { groceriesResources } from './resources';
import { GroceryMutationKeys } from './registerMutationDefaults';
import {
  applyItemSort,
  applyStoreSort,
  buildOptimisticGrocery,
  buildOptimisticStore,
  storeCascadeDelete,
} from './offline';

export const groceriesModule: HomeModule = {
  id: 'groceries',
  name: 'Groceries',
  description: 'Manage your grocery list with smart categorization',
  icon: ShoppingCart,
  basePath: '/groceries',
  routes: [{ path: '', index: true, component: GroceriesHome }],
  section: 'Food',
  showInNav: true,
  navOrder: 2,
  enabled: true,
  resources: groceriesResources,
  // Offline overrides supply the groceries-specific bits (sort, optimistic
  // shape, the store→items cascade, and legacy `*-item` mutation key
  // aliases for in-flight v1 persisted queues). The generic factory in
  // `homestead-core` handles everything else.
  offlineOverrides: {
    grocery: {
      listQueryKey: queryKeys.module('groceries').list(),
      sort: applyItemSort as unknown as (rs: { id: string }[]) => { id: string }[],
      buildOptimistic: buildOptimisticGrocery as unknown as (
        vars: { tempId: string } & Record<string, unknown>,
      ) => { id: string },
      toCreateBody: (vars) => ({
        name: (vars as { name?: string }).name,
        notes: (vars as { notes?: string }).notes ?? '',
        store: (vars as { store?: string }).store ?? '',
        checked: false,
      }),
      legacyKeys: {
        create: GroceryMutationKeys.createItem,
        update: GroceryMutationKeys.updateItem,
        delete: GroceryMutationKeys.deleteItem,
      },
    },
    store: {
      listQueryKey: queryKeys.module('groceries').detail('stores'),
      sort: applyStoreSort as unknown as (rs: { id: string }[]) => { id: string }[],
      buildOptimistic: buildOptimisticStore as unknown as (
        vars: { tempId: string } & Record<string, unknown>,
      ) => { id: string },
      toCreateBody: (vars) => ({
        name: (vars as { name?: string }).name,
        sort_order: (vars as { sort_order?: number }).sort_order ?? 0,
      }),
      cascadeDelete: storeCascadeDelete,
      legacyKeys: {
        create: GroceryMutationKeys.createStore,
        update: GroceryMutationKeys.updateStore,
        delete: GroceryMutationKeys.deleteStore,
      },
    },
  },
  omnibox: groceriesOmnibox,
  flags: {
    default_store: {
      type: 'string',
      label: 'Default store',
      description:
        'Store id pre-selected when adding new grocery items. Leave blank for no default.',
      default: '',
    },
  },
  widgets: [
    {
      id: 'groceries-remaining',
      label: 'Groceries',
      component: GroceriesWidget,
      order: 10,
    },
  ],
  workers: {
    'process-image': {
      method: 'POST',
      load: () => import('./workers/process-image'),
    },
  },
};
