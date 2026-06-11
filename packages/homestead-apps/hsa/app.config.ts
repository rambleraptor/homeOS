/**
 * HSA App Configuration
 *
 * App for tracking unreimbursed medical expenses
 */

import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';
import { hsaResources } from './resources';

export const hsaApp: AppConfig = {
  id: 'hsa',
  name: 'HSA Receipts',
  description: 'Track unreimbursed medical expenses for tax-free HSA withdrawals',
  icon: () => import('lucide-react').then((m) => m.Receipt),
  basePath: '/hsa',
  routes: [
    {
      path: '',
      index: true,
      component: () => import('./components/HSAHome').then((m) => m.HSAHome),
    },
  ],
  showInNav: true,
  navOrder: 4,
  section: 'Money',
  enabled: true,
  resources: hsaResources,
};
