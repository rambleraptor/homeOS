/**
 * Games — parent module that groups Mini Golf, Pictionary, and
 * Bridge under a single sidebar entry in the Relationships section.
 *
 * Sub-pages are declared via `children` (full `HomeModule`s living
 * in `./<game>/module.config.ts`); the registry handles route
 * aggregation and validation. Adding a new game is "create a child
 * module + add it to `children`" — no manual landing component
 * required.
 */

import type { HomeModule } from '@rambleraptor/homestead-core/modules/types';
import { minigolfModule } from './minigolf/module.config';
import { pictionaryModule } from './pictionary/module.config';
import { bridgeModule } from './bridge/module.config';

export const gamesModule: HomeModule = {
  id: 'games',
  name: 'Games',
  description: 'Track games you play with the people in your life',
  icon: () => import('lucide-react').then((m) => m.Gamepad2),
  basePath: '/games',
  routes: [
    {
      path: '',
      index: true,
      component: () => import('./GamesLanding').then((m) => m.GamesLanding),
    },
  ],
  section: 'Relationships',
  showInNav: true,
  navOrder: 22,
  enabled: true,
  children: [minigolfModule, pictionaryModule, bridgeModule],
};
