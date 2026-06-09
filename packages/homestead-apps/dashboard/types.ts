/**
 * Dashboard App Types
 *
 * The dashboard composes widgets contributed by other apps; the
 * widget contract itself lives in `@rambleraptor/homestead-core/apps/types` (`DashboardWidget`).
 */

export interface DashboardStats {
  totalUsers: number;
  activeApps: number;
  recentActivity: number;
}
