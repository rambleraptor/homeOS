/**
 * Permissions — child of the Superuser app.
 *
 * Surfaces the admin UI for the permissions data model: groups (create, delete,
 * manage membership) and a read-only view of the built-in roles. Sidebar
 * placement is owned by the parent (`superuserApp`). Managing groups/roles is a
 * superuser-only concern, so the route carries the hard `superuser` gate (like
 * the Users app) in addition to the `enabled` flag — a superuser flipping the
 * flag to `'all'` still can't expose it to regular users.
 *
 * The underlying `role` / `group` / `group-membership` / `access-grant`
 * collections are declared centrally (`permissions/resources.ts`) and applied by
 * the schema sync, so this app declares no `resources` of its own.
 */

import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';

export const permissionsApp: AppConfig = {
  id: 'permissions',
  name: 'Permissions',
  description: 'Manage groups and view roles.',
  web: {
    icon: () => import('lucide-react').then((m) => m.KeyRound),
    basePath: '/superuser/permissions',
    routes: [
      {
        path: '',
        index: true,
        component: () =>
          import('./components/PermissionsHome').then((m) => m.PermissionsHome),
        gates: ['superuser'],
      },
    ],
  },
};
