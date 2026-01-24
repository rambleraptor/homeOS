/**
 * Notifications Module Exports
 *
 * Central export point for the notifications module
 */

export { notificationsModule } from './module.config';
export type {
  Notification,
  NotificationType,
  NotificationStats,
  NotificationTiming,
  RecurringNotification,
  RecurringNotificationInput,
} from './types';
export { NOTIFICATION_TIMING_OPTIONS } from './types';

// Recurring notification hooks
export {
  useRecurringNotifications,
  useAllRecurringNotifications,
} from './hooks/useRecurringNotifications';
export {
  useCreateRecurringNotification,
  useDeleteRecurringNotification,
  useUpdateRecurringNotificationEnabled,
  useSyncRecurringNotifications,
} from './hooks/useRecurringNotificationMutations';
