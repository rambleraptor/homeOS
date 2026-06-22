/**
 * Dashboard App Configuration
 *
 * Main dashboard app providing overview of the Homestead system.
 * Displays welcome message, statistics, and getting started guide.
 */

import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';

export const dashboardApp: AppConfig = {
  id: 'dashboard',
  name: 'Dashboard',
  description: 'Overview of your Homestead system',
  web: {
    icon: () => import('lucide-react').then((m) => m.LayoutDashboard),
    basePath: '/dashboard',
    routes: [
      {
        path: '',
        index: true,
        component: () =>
          import('./components/DashboardHome').then((m) => m.DashboardHome),
      },
    ],
    showInNav: false,
    navOrder: 1,
  },
};
