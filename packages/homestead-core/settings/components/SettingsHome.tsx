import { DashboardWidgetSettings } from './DashboardWidgetSettings';
import { NotificationDevices } from './NotificationDevices';
import { ChangePasswordForm } from './ChangePasswordForm';
import { AppUserSettingsCard } from '@rambleraptor/homestead-core/user-settings/components/AppUserSettingsCard';
import { getAllSettingsWidgets } from '@rambleraptor/homestead-core/apps/registry';
import { PageHeader } from '@rambleraptor/homestead-core/shared/components/PageHeader';

export function SettingsHome() {
  const appSettings = getAllSettingsWidgets();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Manage your preferences and notifications"
      />

      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Notifications
        </h2>
        <NotificationDevices />
      </div>

      <DashboardWidgetSettings />

      {appSettings.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            App Settings
          </h2>
          <div
            className="space-y-4"
            data-testid="app-user-settings-list"
          >
            {appSettings.map(({ appId, app }) => (
              <AppUserSettingsCard key={appId} app={app} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Security
        </h2>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
