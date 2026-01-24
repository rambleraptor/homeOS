export type NotificationType = 'day_of' | 'day_before' | 'week_before' | 'system';

export type NotificationTiming = 'day_of' | 'day_before' | 'week_before';

export interface Notification {
  id: string;
  user_id: string;
  /** @deprecated Use source_collection + source_id instead */
  person_id?: string;
  title: string;
  message: string;
  notification_type: NotificationType;
  scheduled_for?: string;
  sent_at?: string;
  read: boolean;
  read_at?: string;
  created: string;
  updated: string;
  // New universal fields
  recurring_notification_id?: string;
  source_collection?: string;
  source_id?: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  read: number;
}

/**
 * RecurringNotification defines a notification that should be triggered
 * on a recurring basis (e.g., yearly for birthdays).
 *
 * The daily cron job checks all enabled recurring notifications and creates
 * Notification instances when the timing matches.
 */
export interface RecurringNotification {
  id: string;
  user_id: string;
  /** The collection the source record belongs to (e.g., "people") */
  source_collection: string;
  /** The ID of the source record */
  source_id: string;
  /** Template for notification title. Supports {{name}}, {{date}} placeholders */
  title_template: string;
  /** Template for notification message. Supports {{name}}, {{date}} placeholders */
  message_template: string;
  /** Which field on the source record contains the reference date */
  reference_date_field: string;
  /** When to send relative to the reference date */
  timing: NotificationTiming;
  /** Whether this recurring notification is active */
  enabled: boolean;
  /** When this last triggered a notification */
  last_triggered?: string;
  created: string;
  updated: string;
}

/**
 * Input for creating a recurring notification
 */
export interface RecurringNotificationInput {
  source_collection: string;
  source_id: string;
  title_template: string;
  message_template: string;
  reference_date_field: string;
  timing: NotificationTiming;
  enabled?: boolean;
}

/**
 * Constants for notification timing options
 */
export const NOTIFICATION_TIMING_OPTIONS = [
  { value: 'day_of' as const, label: 'On the day', description: 'Get notified on the day' },
  { value: 'day_before' as const, label: 'Day before', description: 'Get notified one day before' },
  { value: 'week_before' as const, label: 'Week before', description: 'Get notified one week before' },
] as const;
