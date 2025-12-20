export type PersonEventType = 'birthday' | 'anniversary';

export type NotificationPreference = 'day_of' | 'day_before' | 'week_before';

export interface Person {
  id: string;
  name: string;
  address?: string;
  birthday?: string;
  anniversary?: string;
  notification_preferences: NotificationPreference[];
  created_by: string;
  created: string;
  updated: string;
}

export interface PersonFormData {
  name: string;
  address?: string;
  birthday?: string;
  anniversary?: string;
  notification_preferences: NotificationPreference[];
}

export interface PeopleStats {
  totalPeople: number;
  upcomingBirthdays: number;
  upcomingAnniversaries: number;
}

export interface NotificationPreferenceOption {
  value: NotificationPreference;
  label: string;
  description: string;
}

export const NOTIFICATION_PREFERENCE_OPTIONS: NotificationPreferenceOption[] = [
  {
    value: 'day_of',
    label: 'On the day',
    description: 'Get notified on the day of the birthday or anniversary',
  },
  {
    value: 'day_before',
    label: 'The day before',
    description: 'Get notified one day before the birthday or anniversary',
  },
  {
    value: 'week_before',
    label: 'A week before',
    description: 'Get notified one week before the birthday or anniversary',
  },
];
