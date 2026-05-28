/**
 * HSA Module Configuration
 *
 * Module for tracking unreimbursed medical expenses
 */

import type { HomeModule } from '@rambleraptor/homestead-core/modules/types';
import { HSAHome } from './components/HSAHome';
import { hsaResources } from './resources';

export const hsaModule: HomeModule = {
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
  omnibox: {
    synonyms: [
      'hsa',
      'medical',
      'receipt',
      'receipts',
      'dental',
      'vision',
      'rx',
      'prescription',
      'doctor',
      'pharmacy',
    ],
    listComponent: HSAHome,
  },
  workers: {
    'parse-receipt': {
      method: 'POST',
      load: () => import('./workers/parse-receipt'),
    },
  },
};
