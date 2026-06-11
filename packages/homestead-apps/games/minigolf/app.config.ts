/**
 * Mini Golf — child of the Games app.
 *
 * Sidebar placement is owned by the parent (`gamesApp`); the page itself
 * is gated by this app's own
 * built-in `enabled` flag so it can be turned off independently.
 */

import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';
import { minigolfResources } from './resources';

export const minigolfApp: AppConfig = {
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
