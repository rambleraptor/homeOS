/**
 * Todos App Configuration
 */

import type { HomeApp } from '@rambleraptor/homestead-core/apps/types';
import { todosResources } from './resources';

export const todosApp: HomeApp = {
  id: 'todos',
  name: 'Todos',
  description: 'Daily todo list with progress tracking.',
  icon: () => import('lucide-react').then((m) => m.ListTodo),
  basePath: '/todos',
  routes: [
    {
      path: '',
      index: true,
      component: () => import('./components/TodosHome').then((m) => m.TodosHome),
    },
  ],
  showInNav: true,
  navOrder: 5,
  section: 'Tasks',
  enabled: true,
  defaultEnabled: 'all',
  resources: todosResources,
  widgets: [
    {
      id: 'todos-active',
      label: 'Active todos',
      component: () => import('./components/TodoWidget').then((m) => m.TodoWidget),
      order: 5,
    },
  ],
};
