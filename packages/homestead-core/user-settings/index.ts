/**
 * Per-user module settings — the per-user analog of module flags.
 *
 * Each `HomeModule` may declare a `userSettings` map; declarations
 * flatten into the dynamically-generated `user-preference` resource
 * (one record per user under `/users/{id}/preferences/{id}`). Modules
 * may also supply a custom `settingsWidget`; otherwise the auto-form
 * is rendered on the user Settings page.
 */

export { useUserSetting } from './hooks/useUserSetting';
export type { UseUserSettingResult } from './hooks/useUserSetting';
export { useUserSettings } from './hooks/useUserSettings';
export type { UseUserSettingsResult } from './hooks/useUserSettings';
export { useUpdateUserSetting } from './hooks/useUpdateUserSetting';

export { ModuleUserSettingsCard } from './components/ModuleUserSettingsCard';
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
