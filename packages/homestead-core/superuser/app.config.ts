/**
 * Superuser — parent app that groups superuser-only admin surfaces.
 *
 * Sub-pages are declared via `children` (full `AppConfig`s living
 * in `./<area>/app.config.ts`); the registry handles route
 * aggregation and validation. Each sub-page is gated independently in
 * the App Router.
 */

import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';
import { flagManagementApp } from './flag-management/app.config';

export const superuserApp: AppConfig = {
  id: 'superuser',
  name: 'Superuser',
  description: 'App flags and other superuser-only controls',
  icon: () => import('lucide-react').then((m) => m.ShieldCheck),
  basePath: '/superuser',
  routes: [
    {
      path: '',
      index: true,
      component: () => import('./SuperuserLanding').then((m) => m.SuperuserLanding),
      gates: ['superuser'],
    },
  ],
  section: 'Settings',
  showInNav: true,
  navOrder: 90,
  enabled: true,
  defaultEnabled: 'superusers',
  children: [flagManagementApp],
};
