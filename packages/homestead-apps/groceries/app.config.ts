/**
 * Groceries App Configuration
 *
 * App for managing household grocery list with AI-powered categorization
 */

import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';
import { groceriesResources } from './resources';

export const groceriesApp: AppConfig = {
  id: 'groceries',
  name: 'Groceries',
  description: 'Manage your grocery list with smart categorization',
  icon: () => import('lucide-react').then((m) => m.ShoppingCart),
  basePath: '/groceries',
  routes: [
    {
      path: '',
      index: true,
      component: () =>
        import('./components/GroceriesHome').then((m) => m.GroceriesHome),
    },
  ],
  section: 'Food',
  showInNav: true,
  navOrder: 2,
  enabled: true,
  resources: groceriesResources,
  // Deleting a store re-homes its items under "No Store". Everything
  // else (optimistic shape, body projection, list cache key) is derived
  // from the resource singular by the offline mutation factory.
  offlineOverrides: {
    store: {
      cascadeDelete: () =>
        import('./offline').then((m) => m.storeCascadeDelete),
    },
  },
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
      component: () =>
        import('./components/GroceriesWidget').then((m) => m.GroceriesWidget),
      order: 10,
    },
  ],
};
