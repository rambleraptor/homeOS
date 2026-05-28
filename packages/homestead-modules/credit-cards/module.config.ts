/**
 * Credit Cards Module Configuration
 *
 * Module for tracking credit card perks and rewards
 */

import type { HomeModule } from '@rambleraptor/homestead-core/modules/types';
import { CreditCardsList } from './components/CreditCardsList';
import { creditCardsResources } from './resources';

export const creditCardsModule: HomeModule = {
  id: 'credit-cards',
  name: 'Credit Cards',
  description: 'Track credit card perks and maximize rewards',
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
  enabled: true,
  resources: creditCardsResources,
  // Only the top-level `credit-card` resource gets generic offline
  // CRUD defaults. Perks + redemptions are nested under credit-cards
  // and need parent-id wiring; they retain their hand-written hooks
  // until the factory's nested-resource path lands.
  offlineOverrides: {
    perk: false,
    redemption: false,
  },
  omnibox: {
    synonyms: [
      'credit',
      'card',
      'cards',
      'perk',
      'perks',
      'rewards',
      'chase',
      'amex',
    ],
    listComponent: CreditCardsList,
  },
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
};
