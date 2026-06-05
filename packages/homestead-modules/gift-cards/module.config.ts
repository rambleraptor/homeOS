/**
 * Gift Cards Module Configuration
 *
 * Module for managing household gift cards
 */

import type { HomeModule } from '@rambleraptor/homestead-core/modules/types';
import { giftCardsResources } from './resources';

export const giftCardsModule: HomeModule = {
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
