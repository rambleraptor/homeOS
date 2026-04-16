/**
 * Settings Module Exports
 *
 * Central export point for the settings module
 */

export { settingsModule } from './module.config';
export type {
  NotificationSubscription,
  NotificationSettings,
} from './types';

// Public hook for reading/writing module-scoped settings.
export { useModuleSetting } from './hooks/useModuleSetting';
export type { UseModuleSettingResult } from './hooks/useModuleSetting';
