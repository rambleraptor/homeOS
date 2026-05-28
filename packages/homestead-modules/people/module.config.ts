/**
 * People Module Configuration
 *
 * Module for managing contact information, partners, and addresses.
 * Yearly-recurring events (birthdays, anniversaries, …) live in the
 * Events module.
 */

import type { HomeModule } from '@rambleraptor/homestead-core/modules/types';
import { peopleOmnibox } from './omnibox';
import { peopleResources } from './resources';

export const peopleModule: HomeModule = {
  id: 'people',
  name: 'People',
  description: 'Manage contact information and important dates for people you know',
  icon: () => import('lucide-react').then((m) => m.Users),
  basePath: '/people',
  routes: [
    {
      path: '',
      index: true,
      component: () => import('./components/PeopleHome').then((m) => m.PeopleHome),
    },
    {
      path: 'import',
      component: () => import('./bulk-import').then((m) => m.PeopleBulkImport),
    },
  ],
  section: 'Relationships',
  showInNav: true,
  navOrder: 3,
  enabled: true,
  resources: peopleResources,
  omnibox: peopleOmnibox,
  filters: [
    {
      key: 'name',
      label: 'Name',
      type: 'text',
      description:
        "A substring of the person's name. Used by the People list's name filter.",
    },
  ],
  userSettings: {
    map_provider: {
      type: 'enum',
      label: 'Map provider',
      description:
        'Which map service to use when opening addresses from People.',
      options: ['google', 'apple'],
      default: 'google',
    },
  },
};
