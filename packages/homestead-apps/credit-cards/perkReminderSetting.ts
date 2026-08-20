/**
 * The key of the credit-cards per-user perk-reminder opt-in.
 *
 * Its own module because both sides need it and neither may import the other:
 * the toggle is a browser component, the cron that reads the setting is
 * server-only (vite stubs `crons/` out of the client bundle).
 */
export const PERK_REMINDER_SETTING = 'perk_reminder';
