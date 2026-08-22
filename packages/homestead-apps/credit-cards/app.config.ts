/**
 * Credit Cards App Configuration
 *
 * App for tracking credit card perks and rewards
 */

import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';
import { creditCardsResources } from './resources';
import { PERK_REMINDER_SETTING } from './perkReminderSetting';

export const creditCardsApp: AppConfig = {
  id: 'credit-cards',
  name: 'Credit Cards',
  description: 'Track credit card perks and maximize rewards',
  resources: creditCardsResources,
  userSettings: {
    // Opt-in per person: the perks are the household's, but only whoever
    // actually goes and uses them wants the nudge.
    [PERK_REMINDER_SETTING]: {
      type: 'boolean',
      label: 'Remind me before a perk window closes',
      description:
        'Get a reminder when a credit you have not used is about to expire — a few days ahead for monthly perks, a month ahead for annual ones.',
      default: false,
    },
  },
  // Turns closing perk windows into notifications queued for 09:00; the
  // notifications app's dispatcher delivers them. Runs before the household is
  // up, and catches up at boot. Handler lives under `crons/`, so it's stubbed
  // out of the browser bundle.
  crons: [
    {
      id: 'credit-cards-perk-reminders',
      title: 'Closing perk windows',
      dailyAtHour: 3,
      runOnStart: true,
      load: () => import('./crons/perk-reminders'),
    },
  ],
  web: {
    icon: () => import('lucide-react').then((m) => m.CreditCard),
    basePath: '/credit-cards',
    routes: [
      {
        path: '',
        index: true,
        component: () =>
          import('./components/CreditCardsHome').then((m) => m.CreditCardsHome),
      },
    ],
    showInNav: true,
    navOrder: 5,
    section: 'Money',
    widgets: [
      {
        id: 'credit-cards-upcoming-perks',
        label: 'Upcoming credit card perks',
        component: () =>
          import('./components/UpcomingPerksWidget').then(
            (m) => m.UpcomingPerksWidget,
          ),
        order: 20,
      },
    ],
  },
};
