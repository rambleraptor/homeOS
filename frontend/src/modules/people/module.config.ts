/**
 * People Module Configuration
 *
 * Module for managing contact information and important dates.
 * Supports tracking birthdays, anniversaries, and addresses.
 */

import { Users } from 'lucide-react';
import type { HomeModule } from '../types';
import { peopleRoutes } from './routes';

export const peopleModule: HomeModule = {
  id: 'people',
  name: 'People',
  description: 'Manage contact information and important dates for people you know',
  icon: Users,
  basePath: '/people',
  routes: peopleRoutes,
  showInNav: true,
  navOrder: 3,
  enabled: true,
};
