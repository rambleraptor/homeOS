/**
 * Developer Module Configuration
 *
 * Module for managing automated actions and developer tools.
 * Includes Playwright scripts and other automation tasks.
 */

import { Code } from 'lucide-react';
import type { HomeModule } from '../types';

export const developerModule: HomeModule = {
  id: 'developer',
  name: 'Developer',
  description: 'Manage automated actions and scripts',
  icon: Code,
  basePath: '/developer',
  routes: [
    { path: '', index: true },
    { path: ':actionId' },
  ],
  showInNav: true,
  navOrder: 100, // Show at the end of navigation
  enabled: true,
};
