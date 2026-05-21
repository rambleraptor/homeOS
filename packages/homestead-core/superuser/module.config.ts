/**
 * Superuser — parent module that groups superuser-only admin surfaces.
 *
 * Sub-pages are declared via `children` (full `HomeModule`s living
 * in `./<area>/module.config.ts`); the registry handles route
 * aggregation and validation, and the omnibox `listComponent` is a
 * generic `<NestedModuleLanding>` that auto-renders one card per
 * child. Each sub-page is gated independently in the App Router.
 */

import { ShieldCheck } from 'lucide-react';
import type { HomeModule } from '@rambleraptor/homestead-core/modules/types';
import { makeNestedModuleLanding } from '@rambleraptor/homestead-core/shared/components/makeNestedModuleLanding';
import { flagManagementModule } from './flag-management/module.config';
import { SuperuserLanding } from './SuperuserLanding';

export const superuserModule: HomeModule = {
  id: 'superuser',
  name: 'Superuser',
  description: 'Module flags and other superuser-only controls',
  icon: ShieldCheck,
  basePath: '/superuser',
  routes: [
    { path: '', index: true, component: SuperuserLanding, gates: ['superuser'] },
  ],
  section: 'Settings',
  showInNav: true,
  navOrder: 90,
  enabled: true,
  defaultEnabled: 'superusers',
  children: [flagManagementModule],
  omnibox: {
    synonyms: [
      'superuser',
      'admin',
      'flags',
      'flag management',
    ],
    listComponent: makeNestedModuleLanding(() => superuserModule),
  },
};
