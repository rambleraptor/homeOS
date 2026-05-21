/**
 * Dashboard Module Types
 *
 * The dashboard composes widgets contributed by other modules; the
 * widget contract itself lives in `@rambleraptor/homestead-core/modules/types` (`DashboardWidget`).
 */

export interface DashboardStats {
  totalUsers: number;
  activeModules: number;
  recentActivity: number;
}
