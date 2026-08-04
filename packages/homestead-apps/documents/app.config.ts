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
  // Pull document attachments out of incoming email every 5 minutes. No-ops
  // when no email provider is configured. The handler lives under `crons/` so
  // it's stubbed out of the browser bundle; the import stays lazy.
  crons: [
    {
      id: 'documents-ingest-email',
      title: 'Ingest email attachments',
      intervalSeconds: 300,
      load: () => import('./crons/ingest-email'),
    },
  ],
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
      // Before `:id`, which would otherwise match "types" as a document id.
      {
        path: 'types',
        component: () =>
          import('./components/DocumentTypes').then((m) => m.DocumentTypes),
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
