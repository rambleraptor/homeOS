import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';

const alphaApp: AppConfig = {
  id: 'alpha',
  name: 'Alpha',
  description: 'Discovery fixture app.',
  icon: () => import('lucide-react').then((m) => m.Package),
  basePath: '/alpha',
  routes: [],
};

export default alphaApp;
