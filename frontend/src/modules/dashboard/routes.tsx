/**
 * Dashboard Module Routes
 */

import type { RouteObject } from 'react-router-dom';
import { DashboardHome } from './components/DashboardHome';

export const dashboardRoutes: RouteObject[] = [
  {
    index: true,
    element: <DashboardHome />,
  },
];
