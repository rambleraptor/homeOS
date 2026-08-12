/**
 * Home App Configuration
 *
 * A single page covering the house itself: upcoming curb pickups (from the
 * `garbage-pickup` collection this app owns) above the household's
 * home-related documents (manuals, warranties, insurance, property tax), which
 * are surfaced by reusing the Documents app's data. The asset inventory and
 * maintenance schedule are planned follow-ups.
 */

import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';
import { homeResources } from './resources';

export const homeApp: AppConfig = {
  id: 'home',
  name: 'Home',
  description: 'Curb pickups and home documents in one place',
  resources: homeResources,
  web: {
    icon: () => import('lucide-react').then((m) => m.House),
    basePath: '/home',
    routes: [
      {
        path: '',
        index: true,
        component: () => import('./components/HomePage').then((m) => m.HomePage),
      },
    ],
    showInNav: true,
    // Leads the "Home" nav section, ahead of Documents (navOrder 5).
    navOrder: 1,
    section: 'Home',
    widgets: [
      {
        id: 'home-next-pickup',
        label: 'Next pickup',
        component: () =>
          import('./components/NextPickupWidget').then((m) => m.NextPickupWidget),
        order: 15,
      },
    ],
  },
};
