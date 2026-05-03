'use client';

/**
 * Dashboard Home Component
 *
 * Renders a stack of widgets contributed by other modules. Modules
 * declare widgets via `HomeModule.widgets`; the dashboard discovers
 * them through `getAllDashboardWidgets()`, then defers to the user's
 * own dashboard preferences (saved via the settings UI) for the
 * order and visibility of each widget.
 */

import { useAuth } from '@rambleraptor/homestead-core/auth/useAuth';
import { getTodaysHoliday } from '@rambleraptor/homestead-core/shared/utils/dateUtils';
import { PageHeader } from '@rambleraptor/homestead-core/shared/components/PageHeader';
import { resolveDashboardWidgets } from '@rambleraptor/homestead-core/settings/utils/resolveDashboardWidgets';
import { getAllDashboardWidgets } from '@/modules/registry';

export function DashboardHome() {
  const { user } = useAuth();
  const todaysHoliday = getTodaysHoliday();
  const widgets = resolveDashboardWidgets(
    getAllDashboardWidgets(),
    user?.dashboard_widget_order,
    user?.dashboard_hidden_widgets,
  );

  const greeting = todaysHoliday
    ? todaysHoliday.message
    : user?.name
    ? `Welcome back, ${user.name}`
    : 'Welcome back';

  return (
    <div className="space-y-6">
      <PageHeader title={greeting} subtitle="Here's what's happening" />

      <div className="max-w-3xl space-y-6">
        {widgets.map(({ id, component: Widget }) => (
          <Widget key={id} />
        ))}
      </div>
    </div>
  );
}
