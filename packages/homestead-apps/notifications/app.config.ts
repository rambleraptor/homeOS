/**
 * Notifications App Configuration
 *
 * App for viewing and managing user notifications.
 * Displays event reminders and system notifications.
 */

import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';
import { notificationsResources } from './resources';

export const notificationsApp: AppConfig = {
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
  placement: 'topbar',
  topBarBadge: () =>
    import('./components/NotificationsTopBarBadge').then(
      (m) => m.NotificationsTopBarBadge,
    ),
  navOrder: 4,
  resources: notificationsResources,
};
