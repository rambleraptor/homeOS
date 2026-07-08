export type NotificationType = 'day_of' | 'day_before' | 'week_before' | 'system';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: NotificationType;
  scheduled_for?: string;
  sent_at?: string;
  read: boolean;
  read_at?: string;
  /** Client-side normalized alias of the wire `create_time` (see useNotificationStats#normalize). */
  created: string;
  /** Client-side normalized alias of the wire `update_time`. */
  updated: string;
  source_collection?: string;
  source_id?: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  read: number;
}
