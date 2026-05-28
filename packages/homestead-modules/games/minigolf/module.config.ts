/**
 * Mini Golf — child of the Games module.
 *
 * Sidebar placement and the omnibox surface are owned by the parent
 * (`gamesModule`); the page itself is gated by this module's own
 * built-in `enabled` flag so it can be turned off independently.
 */

import type { HomeModule } from '@rambleraptor/homestead-core/modules/types';
import { minigolfResources } from './resources';

export const minigolfModule: HomeModule = {
  id: 'minigolf',
  name: 'Mini Golf',
  description: 'Play and track mini golf games',
  icon: () => import('lucide-react').then((m) => m.Flag),
  basePath: '/games/minigolf',
  routes: [
    {
      path: '',
      index: true,
      component: () =>
        import('./components/MinigolfHome').then((m) => m.MinigolfHome),
      gates: ['enabled'],
    },
  ],
  enabled: true,
  resources: minigolfResources,
};
