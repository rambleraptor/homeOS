/**
 * Home App Configuration
 *
 * The simple first version: a single page that surfaces the household's
 * home-related documents (manuals, warranties, insurance, property tax) by
 * reusing the Documents app's data. It owns no resources of its own yet — the
 * asset inventory, maintenance schedule, and reminders are planned follow-ups.
 */

import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';

export const homeApp: AppConfig = {
  id: 'home',
  name: 'Home',
  description: 'Your home documents in one place',
  web: {
    icon: () => import('lucide-react').then((m) => m.House),
    basePath: '/home',
    routes: [
      {
        path: '',
        index: true,
        component: () =>
          import('./components/HomeDocuments').then((m) => m.HomeDocuments),
      },
    ],
    showInNav: true,
    // Leads the "Home" nav section, ahead of Documents (navOrder 5).
    navOrder: 1,
    section: 'Home',
  },
};
