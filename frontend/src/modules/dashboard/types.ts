/**
 * Dashboard Module Types
 */

export interface DashboardWidget {
  id: string;
  title: string;
  type: 'stat' | 'chart' | 'list' | 'custom';
  data?: unknown;
  config?: Record<string, unknown>;
}

export interface DashboardData {
  widgets: DashboardWidget[];
  lastUpdated: string;
}

export interface DashboardStats {
  totalUsers: number;
  activeModules: number;
  recentActivity: number;
}
