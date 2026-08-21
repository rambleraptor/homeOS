/**
 * Per-user app settings — the per-user analog of app flags.
 *
 * Each `AppConfig` may declare a `userSettings` map; declarations
 * flatten into the dynamically-generated `user-preference` resource
 * (one record per user under `/users/{id}/preferences/{id}`). Apps
 * may also supply a custom `settingsWidget`; otherwise the auto-form
 * is rendered on the user Settings page.
 */

export { useUserSetting } from './hooks/useUserSetting';
export type { UseUserSettingResult } from './hooks/useUserSetting';
export { useUserSettings } from './hooks/useUserSettings';
export type { UseUserSettingsResult } from './hooks/useUserSettings';
export { useUpdateUserSetting } from './hooks/useUpdateUserSetting';

export { AppUserSettingsCard } from './components/AppUserSettingsCard';
export { ReminderOptInToggle } from './components/ReminderOptInToggle';
export type { ReminderOptInToggleProps } from './components/ReminderOptInToggle';
export { UserSettingsAutoForm } from './components/UserSettingsAutoForm';

export {
  fieldName,
  parseFieldName,
  unflatten,
  withDefaults,
  buildSchemaProperties,
  USER_SETTING_SEPARATOR,
} from './settings';
export type { UserSettingDefs, UserSettingValues } from './settings';

export { syncUserSettingsSchema } from './sync';
