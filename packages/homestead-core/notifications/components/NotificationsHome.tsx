import { useState } from 'react';
import { Bell, Check, Calendar } from 'lucide-react';
import { Card } from '@rambleraptor/homestead-core/shared/components/Card';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import { Spinner } from '@rambleraptor/homestead-core/shared/components/Spinner';
import { PageHeader } from '@rambleraptor/homestead-core/shared/components/PageHeader';
import { useNotifications } from '../hooks/useNotifications';
import { useMarkNotificationAsRead } from '../hooks/useMarkNotificationAsRead';
import { useHasOngoingOperations } from '../hooks/useOperations';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import type { Notification } from '../types';
import { OperationsList } from './OperationsList';

type Tab = 'notifications' | 'operations';

function NotificationsPanel() {
  const { data: notifications, isLoading } = useNotifications();
  const markAsRead = useMarkNotificationAsRead();

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead.mutateAsync(id);
    } catch (error) {
      logger.error('Failed to mark notification as read', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
  };

  const getNotificationIcon = (notification: Notification) => {
    // Use source_collection for icon selection (with person_id fallback for backward compatibility)
    if (notification.source_collection === 'people' || notification.person_id) {
      return <Calendar className="w-5 h-5 text-blue-500" />;
    }
    return <Bell className="w-5 h-5 text-gray-500" />;
  };

  const unreadNotifications = notifications?.filter((n) => !n.read) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {unreadNotifications.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Unread Notifications
          </h2>
          <div className="space-y-3">
            {unreadNotifications.map((notification) => (
              <Card key={notification.id}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getNotificationIcon(notification)}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {notification.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        {formatDate(notification.created)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleMarkAsRead(notification.id)}
                    disabled={markAsRead.isPending}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Mark as Read
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!notifications || unreadNotifications.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No notifications yet</p>
            <p className="text-sm text-gray-500 mt-2">
              You'll receive notifications for upcoming events here
            </p>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  testId,
  children,
}: {
  active: boolean;
  onClick: () => void;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-colors ${
        active
          ? 'border-brand-navy text-brand-navy'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

export function NotificationsHome() {
  const [tab, setTab] = useState<Tab>('notifications');
  const hasOngoingOperations = useHasOngoingOperations();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Center"
        subtitle="View and manage your notifications and operations"
      />

      <div className="flex gap-2 border-b border-gray-200">
        <TabButton
          active={tab === 'notifications'}
          onClick={() => setTab('notifications')}
          testId="notifications-tab"
        >
          Notifications
        </TabButton>
        <TabButton
          active={tab === 'operations'}
          onClick={() => setTab('operations')}
          testId="operations-tab"
        >
          <span className="inline-flex items-center gap-2">
            Operations
            {hasOngoingOperations && <Spinner size="sm" />}
          </span>
        </TabButton>
      </div>

      {tab === 'notifications' ? <NotificationsPanel /> : <OperationsList />}
    </div>
  );
}
