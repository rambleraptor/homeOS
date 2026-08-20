/**
 * Home App Configuration
 *
 * A single page covering the house itself: upcoming curb pickups (from the
 * `garbage-pickup` collection this app owns) above the household's
 * home-related documents (manuals, warranties, insurance, property tax), which
 * are surfaced by reusing the Documents app's data. The asset inventory and
 * maintenance schedule are planned follow-ups.
 */

import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';
import { homeResources } from './resources';
import { PICKUP_REMINDER_SETTING } from './pickupReminderSetting';

export const homeApp: AppConfig = {
  id: 'home',
  name: 'Home',
  description: 'Curb pickups and home documents in one place',
  resources: homeResources,
  userSettings: {
    // Opt-in per person: whoever wheels the bins out wants the nudge, and a
    // household-wide flag would buzz everyone else's phone every week.
    [PICKUP_REMINDER_SETTING]: {
      type: 'boolean',
      label: 'Remind me the night before pickup',
      description:
        'Get a reminder at 6pm the evening before each collection day, listing which bins go out.',
      default: false,
    },
  },
  // Turns the pickup calendar into reminders the evening reminder cron delivers.
  // Runs before the household is awake, and catches up at boot so a restart
  // can't lose tonight's bin reminder. Handler lives under `crons/`, so it's
  // stubbed out of the browser bundle.
  crons: [
    {
      id: 'home-pickup-reminders',
      title: 'Bin night reminders',
      dailyAtHour: 4,
      runOnStart: true,
      load: () => import('./crons/pickup-reminders'),
    },
  ],
  web: {
    icon: () => import('lucide-react').then((m) => m.House),
    basePath: '/home',
    routes: [
      {
        path: '',
        index: true,
        component: () => import('./components/HomePage').then((m) => m.HomePage),
      },
    ],
    showInNav: true,
    // Leads the "Home" nav section, ahead of Documents (navOrder 5).
    navOrder: 1,
    section: 'Home',
    widgets: [
      {
        id: 'home-next-pickup',
        label: 'Next pickup',
        component: () =>
          import('./components/NextPickupWidget').then((m) => m.NextPickupWidget),
        order: 15,
      },
    ],
  },
};
