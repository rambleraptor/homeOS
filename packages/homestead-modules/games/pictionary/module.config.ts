/**
 * Pictionary — child of the Games module.
 *
 * Sidebar placement and the omnibox surface are owned by the parent
 * (`gamesModule`); the page itself is gated by this module's own
 * built-in `enabled` flag so it can be turned off independently.
 */

import type { HomeModule } from '@rambleraptor/homestead-core/modules/types';
import { pictionaryResources } from './resources';

export const pictionaryModule: HomeModule = {
  id: 'pictionary',
  name: 'Pictionary',
  description: 'Track Pictionary games, teams, and winning words',
  icon: () => import('lucide-react').then((m) => m.Pencil),
  basePath: '/games/pictionary',
  routes: [
    {
      path: '',
      index: true,
      component: () =>
        import('./components/PictionaryHome').then((m) => m.PictionaryHome),
      gates: ['enabled'],
    },
    {
      path: 'leaderboard',
      component: () =>
        import('./components/PictionaryLeaderboard').then(
          (m) => m.PictionaryLeaderboard,
        ),
      gates: ['enabled'],
    },
    {
      path: 'import',
      component: () =>
        import('./bulk-import').then((m) => m.PictionaryBulkImport),
      gates: ['enabled'],
    },
  ],
  enabled: true,
  resources: pictionaryResources,
};
