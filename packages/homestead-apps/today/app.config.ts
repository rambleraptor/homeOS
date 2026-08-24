/**
 * Today App Configuration
 *
 * A widget-only app: it owns no collections and serves no routes. Its single
 * contribution is the Today card, which assembles lines from the apps that do
 * own the data (events, home, groceries, todos, credit-cards) plus the
 * reminders a person scheduled for themselves.
 *
 * It exists as an app rather than as part of the dashboard because the
 * dashboard lives in homestead-core, and core must not import feature apps.
 */

import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';

export const todayApp: AppConfig = {
  id: 'today',
  name: 'Today',
  description: "What the household needs from you today, in one card",
  web: {
    icon: () => import('lucide-react').then((m) => m.Sun),
    basePath: '/today',
    // No routes: the card links into the owning app on every line, so there is
    // nothing a /today page would add that the dashboard doesn't already show.
    routes: [],
    showInNav: false,
    widgets: [
      {
        id: 'today-agenda',
        label: 'Today',
        component: () =>
          import('./components/TodayWidget').then((m) => m.TodayWidget),
        // Ahead of every other widget (todos is the current lead at 5): the
        // card is the dashboard's answer to "what now", so it reads first.
        order: 0,
      },
    ],
  },
};
