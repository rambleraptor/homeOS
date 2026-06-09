/**
 * Dashboard Home Component
 *
 * Renders a stack of widgets contributed by other apps. Apps
 * declare widgets via `HomeApp.widgets`; the dashboard discovers
 * them through `getAllDashboardWidgets()`, then defers to the user's
 * own dashboard preferences (saved via the settings UI) for the
 * order and visibility of each widget.
 */

import { Suspense } from 'react';
import { useAuth } from '@rambleraptor/homestead-core/auth/useAuth';
import { getTodaysHoliday } from '@rambleraptor/homestead-core/shared/utils/dateUtils';
import { PageHeader } from '@rambleraptor/homestead-core/shared/components/PageHeader';
import { resolveDashboardWidgets } from '@rambleraptor/homestead-core/settings/utils/resolveDashboardWidgets';
import { useAppEnabledPredicate } from '@rambleraptor/homestead-core/settings/hooks/useIsAppEnabled';
import { getAllDashboardWidgets } from '@rambleraptor/homestead-core/apps/registry';
import { getLazyComponent } from '@rambleraptor/homestead-core/apps/lazy';

export function DashboardHome() {
  const { user } = useAuth();
  const isAppEnabled = useAppEnabledPredicate();
  const todaysHoliday = getTodaysHoliday();
  // Filter out widgets contributed by apps the viewer can't access
  // (visibility = 'none', wrong audience, missing tag). Otherwise a
  // user could see a Recipes widget on their dashboard while the
  // Recipes app itself is gated off in their sidebar.
  const accessibleWidgets = getAllDashboardWidgets().filter((w) =>
    isAppEnabled(w.appId),
  );
  const widgets = resolveDashboardWidgets(
    accessibleWidgets,
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
        {widgets.map(({ id, component }) => {
          const Widget = getLazyComponent(component);
          return (
            <Suspense key={id} fallback={null}>
              <Widget />
            </Suspense>
          );
        })}
      </div>
    </div>
  );
}
