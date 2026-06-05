/**
 * Bridge — child of the Games module.
 *
 * Sidebar placement is owned by the parent (`gamesModule`); the page itself
 * is gated by this module's own
 * built-in `enabled` flag so it can be turned off independently.
 */

import type { HomeModule } from '@rambleraptor/homestead-core/modules/types';

export const bridgeModule: HomeModule = {
  id: 'bridge',
  name: 'Bridge',
  description: 'Record bids for each hand of Bridge',
  icon: () => import('lucide-react').then((m) => m.Club),
  basePath: '/games/bridge',
  routes: [
    {
      path: '',
      index: true,
      component: () =>
        import('./components/BridgeHome').then((m) => m.BridgeHome),
      gates: ['enabled'],
    },
  ],
  enabled: true,
};
