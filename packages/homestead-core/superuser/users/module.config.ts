/**
 * Users — child of the Superuser module.
 *
 * Sidebar placement and the omnibox surface are owned by the parent
 * (`superuserModule`); the page itself is gated by this module's own
 * built-in `enabled` flag, defaulting to `'superusers'` to match the
 * parent's audience. The route also applies the explicit `'superuser'`
 * gate so regular users hitting `/superuser/users` directly are
 * redirected.
 *
 * The underlying `user` collection is owned by aepbase via
 * `EnableUsers = true`; this module deliberately does not declare a
 * `user` `ResourceDefinition`. Account-level extensions (currently
 * just `account-tag`) live as separate child resources parented under
 * `user`.
 */

import { UserCog } from 'lucide-react';
import type { HomeModule } from '@/modules/types';
import { UsersHome } from './components/UsersHome';
import { usersResources } from './resources';

export const usersModule: HomeModule = {
  id: 'users',
  name: 'Users',
  description: 'Create and manage user accounts.',
  icon: UserCog,
  basePath: '/superuser/users',
  routes: [
    {
      path: '',
      index: true,
      component: UsersHome,
      gates: ['superuser', 'enabled'],
    },
  ],
  enabled: true,
  defaultEnabled: 'superusers',
  resources: usersResources,
};
