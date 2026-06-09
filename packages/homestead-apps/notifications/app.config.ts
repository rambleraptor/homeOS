/**
 * Notifications App Configuration
 *
 * App for viewing and managing user notifications.
 * Displays event reminders and system notifications.
 */

import type { HomeApp } from '@rambleraptor/homestead-core/apps/types';
import { notificationsResources } from './resources';

export const notificationsApp: HomeApp = {
  id: 'notifications',
  name: 'Notifications',
  description: 'View and manage your notifications',
  icon: () => import('lucide-react').then((m) => m.Bell),
  basePath: '/notifications',
  routes: [
    {
      path: '',
      index: true,
      component: () =>
        import('./components/NotificationsHome').then((m) => m.NotificationsHome),
    },
  ],
  showInNav: false,
  navOrder: 4,
  enabled: true,
  resources: notificationsResources,
};
