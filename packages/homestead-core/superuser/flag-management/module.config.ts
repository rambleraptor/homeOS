/**
 * Flag Management — child of the Superuser module.
 *
 * Sidebar placement is owned by the parent (`superuserModule`); the page itself
 * is gated by this module's own
 * built-in `enabled` flag, defaulting to `'superusers'` to match the
 * parent's audience.
 */

import type { HomeModule } from '@rambleraptor/homestead-core/modules/types';

export const flagManagementModule: HomeModule = {
  id: 'flag-management',
  name: 'Flag Management',
  description: 'View and edit every module flag registered in aepbase.',
  icon: () => import('lucide-react').then((m) => m.Flag),
  basePath: '/superuser/flag-management',
  routes: [
    {
      path: '',
      index: true,
      component: () =>
        import('./components/FlagManagementHome').then((m) => m.FlagManagementHome),
      gates: ['enabled'],
    },
  ],
  enabled: true,
  defaultEnabled: 'superusers',
};
