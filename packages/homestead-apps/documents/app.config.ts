/**
 * Documents App Configuration
 *
 * Stores household documents — the file plus whatever metadata the AI can parse
 * out of it. Document types are declared as static TypeScript modules (see
 * `doc-types/`), so the resource schema is fully known at import time.
 */

import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';
import { documentsResources } from './resources';

export const documentsApp: AppConfig = {
  id: 'documents',
  name: 'Documents',
  description: 'Store documents and parse their details automatically',
  resources: documentsResources,
  web: {
    icon: () => import('lucide-react').then((m) => m.FileText),
    basePath: '/documents',
    routes: [
      {
        path: '',
        index: true,
        component: () =>
          import('./components/DocumentsHome').then((m) => m.DocumentsHome),
      },
      {
        path: ':id',
        component: () =>
          import('./components/DocumentDetailRoute').then((m) => m.DocumentDetailRoute),
        dynamic: true,
      },
    ],
    section: 'Home',
    showInNav: true,
    navOrder: 5,
  },
};
