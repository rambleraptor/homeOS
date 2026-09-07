/**
 * The key of the Home app's per-user upkeep-reminder opt-in.
 *
 * Its own module for the same reason `pickupReminderSetting` is: the toggle is
 * a browser component and the cron that reads the setting is server-only (vite
 * stubs `crons/` out of the client bundle), so neither may import the other.
 */
export const TASK_REMINDER_SETTING = 'task_reminder';
