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
 * `user` `ResourceDefinition`, and no longer declares any resources of
 * its own (account-tags were retired in favor of permission groups).
 */

import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';

export const usersApp: AppConfig = {
  id: 'users',
  name: 'Users',
  description: 'Create and manage user accounts.',
  // A resource sync mirrors a resource's records to an external system after
  // they change. Because the target is named by `singular`, a sync can watch
  // the built-in `user` resource — which no app owns a definition for. This is
  // left commented out on purpose: enabling it would spawn an operation on every
  // real user write. To turn on the Address/User→Maps example, uncomment this
  // and adapt `syncs/mirror-user-to-maps.example.ts` (see
  // `docs/guides/resource-sync.md`):
  //
  // syncs: [
  //   {
  //     id: 'users-mirror-to-maps',       // stable, globally unique
  //     resource: 'user',                 // the built-in user resource
  //     title: 'Mirror user to Maps',
  //     // on: ['create', 'update', 'delete'],  // default is all three
  //     load: () => import('./syncs/mirror-user-to-maps.example'),
  //   },
  // ],
  web: {
    icon: () => import('lucide-react').then((m) => m.UserCog),
    basePath: '/superuser/users',
    routes: [
      {
        path: '',
        index: true,
        component: () => import('./components/UsersHome').then((m) => m.UsersHome),
        gates: ['superuser'],
      },
    ],
  },
};
