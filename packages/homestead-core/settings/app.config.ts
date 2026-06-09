/**
 * Settings App Configuration
 *
 * App for managing user preferences and notification settings.
 * Enables web push notifications and customization options.
 */

import type { HomeApp } from '@rambleraptor/homestead-core/apps/types';

export const settingsApp: HomeApp = {
  id: 'settings',
  name: 'Settings',
  description: 'Manage your preferences and notifications',
  icon: () => import('lucide-react').then((m) => m.Settings),
  basePath: '/settings',
  routes: [
    {
      path: '',
      index: true,
      component: () => import('./components/SettingsHome').then((m) => m.SettingsHome),
    },
  ],
  section: 'Settings',
  showInNav: true,
  navOrder: 100,
  enabled: true,
};
