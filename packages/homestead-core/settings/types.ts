export interface NotificationSubscription {
  id: string;
  user_id: string;
  subscription_data: PushSubscriptionJSON;
  device_label?: string;
  enabled: boolean;
  created: string;
  updated: string;
}

export interface NotificationSettings {
  enabled: boolean;
  subscription?: PushSubscription;
}
