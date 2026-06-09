/**
 * Gift Cards App Configuration
 *
 * App for managing household gift cards
 */

import type { HomeApp } from '@rambleraptor/homestead-core/apps/types';
import { giftCardsResources } from './resources';

export const giftCardsApp: HomeApp = {
  id: 'gift-cards',
  name: 'Gift Cards',
  description: 'Manage and track household gift cards',
  icon: () => import('lucide-react').then((m) => m.Gift),
  basePath: '/gift-cards',
  routes: [
    {
      path: '',
      index: true,
      component: () =>
        import('./components/GiftCardHome').then((m) => m.GiftCardHome),
    },
    {
      path: 'import',
      component: () =>
        import('./bulk-import').then((m) => m.GiftCardsBulkImport),
    },
  ],
  showInNav: true,
  navOrder: 4,
  section: 'Money',
  enabled: true,
  resources: giftCardsResources,
};
