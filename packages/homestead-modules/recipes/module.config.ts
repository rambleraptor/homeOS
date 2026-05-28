/**
 * Recipes Module Configuration
 *
 * Manages culinary recipes with structured ingredients for scaling.
 * Sidebar visibility is gated by the built-in `enabled` flag — see
 * `useIsModuleEnabled` for the runtime check.
 */

import type { HomeModule } from '@rambleraptor/homestead-core/modules/types';
import { recipesResources } from './resources';

export const recipesModule: HomeModule = {
  id: 'recipes',
  name: 'Recipes',
  description: 'Manage household recipes with structured ingredients.',
  icon: () => import('lucide-react').then((m) => m.ChefHat),
  basePath: '/recipes',
  routes: [
    {
      path: '',
      index: true,
      component: () => import('./components/RecipesHome').then((m) => m.RecipesHome),
    },
    {
      path: ':id',
      component: () =>
        import('./components/RecipeViewRoute').then((m) => m.RecipeViewRoute),
      dynamic: true,
    },
  ],
  showInNav: true,
  navOrder: 5,
  section: 'Food',
  enabled: true,
  defaultEnabled: 'superusers',
  resources: recipesResources,
  filters: [
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'tags', label: 'Tags', type: 'enum', multi: true },
  ],
};
