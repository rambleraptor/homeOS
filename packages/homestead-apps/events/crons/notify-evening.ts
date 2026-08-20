/**
 * The 18:00 reminder firing. Covers everything due between now and tomorrow
 * morning's run — which is what puts "bins out tonight" in front of someone the
 * evening before, rather than at breakfast the day of.
 */

import { createReminderNotifier } from './notifyReminders';

export default createReminderNotifier('evening');
