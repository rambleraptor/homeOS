/**
 * Settings App Exports
 *
 * Central export point for the settings app
 */

export { settingsApp } from './app.config';
export type {
  NotificationSubscription,
  NotificationSettings,
} from './types';

// Public hook for reading/writing app-scoped flags.
export { useAppFlag } from './hooks/useAppFlag';
export type { UseAppFlagResult } from './hooks/useAppFlag';

// Public hook for gating an app by its built-in `enabled` flag.
