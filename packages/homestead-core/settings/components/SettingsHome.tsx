import { Bell, BellOff } from 'lucide-react';
import { Card } from '@rambleraptor/homestead-core/shared/components/Card';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import { Spinner } from '@rambleraptor/homestead-core/shared/components/Spinner';
import { useNotificationSubscription } from '../hooks/useNotificationSubscription';
import { useUpdateNotificationSubscription } from '../hooks/useUpdateNotificationSubscription';
import { useDeleteNotificationSubscription } from '../hooks/useDeleteNotificationSubscription';
import { useSendTestNotification } from '../hooks/useSendTestNotification';
import {
  isNotificationSupported,
  requestNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from '@rambleraptor/homestead-core/utils/notifications';
import { ChangePasswordForm } from './ChangePasswordForm';
import { DashboardWidgetSettings } from './DashboardWidgetSettings';
import { AppUserSettingsCard } from '@rambleraptor/homestead-core/user-settings/components/AppUserSettingsCard';
import { getAllSettingsWidgets } from '@rambleraptor/homestead-core/apps/registry';
import { useToast } from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import { PageHeader } from '@rambleraptor/homestead-core/shared/components/PageHeader';
import { logger } from '@rambleraptor/homestead-core/utils/logger';

export function SettingsHome() {
  const toast = useToast();
  const { data: subscription, isLoading } = useNotificationSubscription();
  const updateSubscription = useUpdateNotificationSubscription();
  const deleteSubscription = useDeleteNotificationSubscription();
  const sendTestNotification = useSendTestNotification();

  const isBrowserSupported = isNotificationSupported();
  const isEnabled = subscription?.enabled || false;
  const appSettings = getAllSettingsWidgets();

  const handleEnableNotifications = async () => {
    try {
      // Request permission
      const granted = await requestNotificationPermission();
      if (!granted) {
        toast.error('Notification permission was denied. Please enable it in your browser settings.');
        return;
      }

      // Subscribe to push notifications
      const pushSubscription = await subscribeToPushNotifications();

      // Save subscription to database
      await updateSubscription.mutateAsync({
        subscription: pushSubscription,
        enabled: true,
      });
    } catch (error) {
      logger.error('Failed to enable notifications', error);
      toast.error('Failed to enable notifications. Please try again.');
    }
  };

  const handleDisableNotifications = async () => {
    try {
      // Unsubscribe from push notifications
      await unsubscribeFromPushNotifications();

      // Delete subscription from database
      await deleteSubscription.mutateAsync();
    } catch (error) {
      logger.error('Failed to disable notifications', error);
      toast.error('Failed to disable notifications. Please try again.');
    }
  };

  const handleSendTestNotification = async () => {
    try {
      const result = await sendTestNotification.mutateAsync();
      toast.success(result.message || 'Test notification sent successfully!');
    } catch (error) {
      logger.error('Failed to send test notification', error);
      toast.error('Failed to send test notification. Make sure you have admin access.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

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

        {!isBrowserSupported ? (
          <Card>
            <div className="flex items-start gap-4">
              <BellOff className="w-6 h-6 text-gray-400 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Notifications Not Supported
                </h3>
                <p className="text-sm text-gray-600">
                  Your browser does not support web push notifications. Please
                  use a modern browser like Chrome, Firefox, or Edge to enable
                  this feature.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                {isEnabled ? (
                  <Bell className="w-6 h-6 text-blue-500 mt-1" />
                ) : (
                  <BellOff className="w-6 h-6 text-gray-400 mt-1" />
                )}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Web Push Notifications
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {isEnabled
                      ? 'You will receive push notifications for important events and reminders.'
                      : 'Enable notifications to receive reminders for birthdays, anniversaries, and other important events.'}
                  </p>
                  {isEnabled && subscription && (
                    <div className="text-xs text-gray-500 mb-4">
                      <p>Status: Active</p>
                      <p>
                        Enabled since:{' '}
                        {new Date(subscription.created).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {isEnabled ? (
                      <Button
                        variant="secondary"
                        onClick={handleDisableNotifications}
                        disabled={deleteSubscription.isPending}
                      >
                        {deleteSubscription.isPending
                          ? 'Disabling...'
                          : 'Disable Notifications'}
                      </Button>
                    ) : (
                      <Button
                        onClick={handleEnableNotifications}
                        disabled={updateSubscription.isPending}
                      >
                        {updateSubscription.isPending
                          ? 'Enabling...'
                          : 'Enable Notifications'}
                      </Button>
                    )}
                    {isEnabled && (
                      <Button
                        variant="secondary"
                        onClick={handleSendTestNotification}
                        disabled={sendTestNotification.isPending}
                      >
                        {sendTestNotification.isPending
                          ? 'Sending...'
                          : 'Send Test Notification'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}
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
