/**
 * The 09:00 reminder firing. Covers everything due between now and the evening
 * run — see `notifyReminders.ts` for the window and dedup rules.
 */

import { createReminderNotifier } from './notifyReminders';

export default createReminderNotifier('morning');
