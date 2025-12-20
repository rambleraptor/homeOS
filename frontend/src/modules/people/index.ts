/**
 * People Module Exports
 *
 * Central export point for the people module
 */

export { peopleModule } from './module.config';
export { peopleRoutes } from './routes';
export type {
  Person,
  PersonEventType,
  PersonFormData,
  PeopleStats,
  NotificationPreference,
  NotificationPreferenceOption,
} from './types';
export { NOTIFICATION_PREFERENCE_OPTIONS } from './types';
