import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';

const betaApp: AppConfig = {
  id: 'beta',
  name: 'Beta',
  description: 'Discovery fixture app (sorts after alpha).',
  icon: () => import('lucide-react').then((m) => m.Package),
  basePath: '/beta',
  routes: [],
};

export default betaApp;
