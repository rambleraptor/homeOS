/**
 * Todos App Configuration
 */

import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';
import { todosResources } from './resources';

export const todosApp: AppConfig = {
  id: 'todos',
  name: 'Todos',
  description: 'Daily todo list with progress tracking.',
  resources: todosResources,
  migrations: [
    {
      id: 'todos-drop-in-progress-status',
      title: 'Move in_progress todos back to pending',
      load: () => import('./migrations/drop-in-progress-status'),
    },
  ],
  web: {
    icon: () => import('lucide-react').then((m) => m.ListTodo),
    basePath: '/todos',
    routes: [
      {
        path: '',
        index: true,
        component: () => import('./components/TodosHome').then((m) => m.TodosHome),
      },
      {
        path: 'templates',
        component: () =>
          import('./components/TemplatesHome').then((m) => m.TemplatesHome),
      },
    ],
    showInNav: true,
    navOrder: 5,
    section: 'Tasks',
    widgets: [
      {
        id: 'todos-active',
        label: 'Active todos',
        component: () => import('./components/TodoWidget').then((m) => m.TodoWidget),
        order: 5,
      },
    ],
  },
};
