export type NotificationType = 'day_of' | 'day_before' | 'week_before' | 'system';

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
  source_collection?: string;
  source_id?: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  read: number;
}

// ----------------------------------------------------------------------------
// AEP-151 operations (shown in the notifications app)
// ----------------------------------------------------------------------------

export type OperationStatus = 'pending' | 'running' | 'succeeded' | 'failed';

/** An AEP-151 long-running operation, normalized for the UI. */
export interface Operation {
  id: string;
  path: string;
  done: boolean;
  status?: OperationStatus;
  method?: string;
  title?: string;
  created_by?: string;
  metadata?: Record<string, unknown>;
  response?: Record<string, unknown>;
  error?: Record<string, unknown>;
  created: string;
  updated: string;
}
