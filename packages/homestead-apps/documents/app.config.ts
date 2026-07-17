/**
 * Documents App Configuration
 *
 * Stores household documents — the file plus whatever metadata the AI can parse
 * out of it. Document types are configured as YAML (see `doc-types/`), so
 * teaching the app a new form is a config change, not a code change.
 */

import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';
import { documentsResources } from './resources';
import { installDocTypesFromModules } from './doc-types/loadDocTypes.client';

export const documentsApp: AppConfig = {
  id: 'documents',
  name: 'Documents',
  description: 'Store documents and parse their details automatically',
  // A thunk: the schema depends on doc types loaded by `boot` below. See
  // resources.ts.
  resources: documentsResources,
  boot: {
    // Sync: an eager import.meta.glob over the bundled + project YAML. The
    // import above is inert on the server (the glob only runs when this is
    // called, which the server never does).
    client: () => {
      installDocTypesFromModules();
    },
    // Lazy import so the server-only loader (node:fs) is never pulled into the
    // client bundle — the build stubs `*.server` modules away.
    server: () =>
      import('./doc-types/loadDocTypes.server').then((m) => {
        m.installDocTypesFromDisk();
      }),
  },
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
    ],
    section: 'Home',
    showInNav: true,
    navOrder: 5,
  },
};
