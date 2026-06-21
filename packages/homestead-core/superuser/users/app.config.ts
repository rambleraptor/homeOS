/**
 * Users — child of the Superuser app for managing user accounts.
 *
 * Sidebar placement is owned by the parent (`superuserApp`); this app
 * surfaces as a card on the Superuser landing page rather than its own
 * nav entry. Defaults to `'superusers'` visibility, and the route applies
 * the explicit `'superuser'` gate so regular users hitting
 * `/superuser/users` directly are redirected.
 *
 * The underlying `user` collection is owned by aepbase via
 * `EnableUsers = true`; this app deliberately does not declare a
 * `user` `ResourceDefinition`. Account-level extensions (currently
 * just `account-tag`) live as separate child resources parented under
 * `user`.
 */

import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';
import { usersResources } from './resources';

export const usersApp: AppConfig = {
  id: 'users',
  name: 'Users',
  description: 'Create and manage user accounts.',
  icon: () => import('lucide-react').then((m) => m.UserCog),
  basePath: '/superuser/users',
  routes: [
    {
      path: '',
      index: true,
      component: () => import('./components/UsersHome').then((m) => m.UsersHome),
      gates: ['superuser', 'enabled'],
    },
  ],
  defaultEnabled: 'superusers',
  resources: usersResources,
};
