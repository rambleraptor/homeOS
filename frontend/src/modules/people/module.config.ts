/**
 * People Module Configuration
 *
 * Module for managing contact information and important dates.
 * Supports tracking birthdays, anniversaries, and addresses.
 */

import { Users } from 'lucide-react';
import type { HomeModule } from '../types';
import { peopleOmnibox } from './omnibox';

export const peopleModule: HomeModule = {
  id: 'people',
  name: 'People',
  description: 'Manage contact information and important dates for people you know',
  icon: Users,
  basePath: '/people',
  routes: [
    { path: '', index: true },
    { path: 'import' },
  ],
  section: 'Relationships',
  showInNav: true,
  navOrder: 3,
  enabled: true,
  omnibox: peopleOmnibox,
  flags: {
    server_search: {
      type: 'boolean',
      label: 'Server-side people search',
      description:
        'Route the People search bar through the aepbase list endpoint via a CEL filter instead of filtering the fetched collection in the browser.',
      default: false,
    },
  },
};
