/**
 * Credit Cards App Configuration
 *
 * App for tracking credit card perks and rewards
 */

import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';
import { creditCardsResources } from './resources';

export const creditCardsApp: AppConfig = {
  id: 'credit-cards',
  name: 'Credit Cards',
  description: 'Track credit card perks and maximize rewards',
  resources: creditCardsResources,
  web: {
    icon: () => import('lucide-react').then((m) => m.CreditCard),
    basePath: '/credit-cards',
    routes: [
      {
        path: '',
        index: true,
        component: () =>
          import('./components/CreditCardsHome').then((m) => m.CreditCardsHome),
      },
    ],
    showInNav: true,
    navOrder: 5,
    section: 'Money',
    widgets: [
      {
        id: 'credit-cards-upcoming-perks',
        label: 'Upcoming credit card perks',
        component: () =>
          import('./components/UpcomingPerksWidget').then(
            (m) => m.UpcomingPerksWidget,
          ),
        order: 20,
      },
    ],
  },
};
