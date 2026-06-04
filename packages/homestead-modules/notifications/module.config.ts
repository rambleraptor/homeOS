/**
 * Notifications Module Configuration
 *
 * Module for viewing and managing user notifications.
 * Displays event reminders and system notifications.
 */

import type { HomeModule } from '@rambleraptor/homestead-core/modules/types';
import { notificationsResources } from './resources';

export const notificationsModule: HomeModule = {
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
