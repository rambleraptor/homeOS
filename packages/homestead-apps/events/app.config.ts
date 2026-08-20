/**
 * Events App Configuration
 *
 * Yearly-recurring household events (birthdays, anniversaries, …).
 * Source of truth for the dashboard's upcoming-events widget.
 */

import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';
import { eventsResources } from './resources';

export const eventsApp: AppConfig = {
  id: 'events',
  name: 'Events',
  description: 'Track yearly-recurring household events',
  resources: eventsResources,
  // Handlers live under `crons/` so they're stubbed out of the browser bundle.
  crons: [
    // Reminder delivery, twice a day. Everything with a due time — a reminder
    // someone typed in, an event a household member asked to be warned about, a
    // bin that goes out tomorrow — is announced by one of these two firings, so
    // Homestead interrupts anybody at exactly two moments a day. Each run covers
    // up to the next one; see `crons/notifyReminders.ts`.
    {
      id: 'reminders-notify-morning',
      title: 'Morning reminders',
      dailyAtHour: 9,
      load: () => import('./crons/notify-morning'),
    },
    {
      id: 'reminders-notify-evening',
      title: 'Evening reminders',
      dailyAtHour: 18,
      load: () => import('./crons/notify-evening'),
    },
    // Turn the events people asked to be reminded about into reminder records,
    // early enough that the morning firing finds them. Reconciles rather than
    // appends, and catches up at boot if the box was down at 01:00.
    {
      id: 'events-materialize-reminders',
      title: 'Event reminders',
      dailyAtHour: 1,
      runOnStart: true,
      load: () => import('./crons/materialize'),
    },
  ],
  // Split the legacy single `date` field into month/day on existing events.
  // One-shot and idempotent (skips events already carrying month/day).
  migrations: [
    {
      id: 'events-split-date',
      title: 'Split event date into month/day',
      load: () => import('./migrations/split-date'),
    },
  ],
  userSettings: {
    countdown_event_id: {
      type: 'string',
      label: 'Countdown: target event',
      description:
        'Id of the event the dashboard countdown widget points to. Empty means the widget shows a configure CTA.',
      default: '',
    },
    countdown_show_months: {
      type: 'boolean',
      label: 'Countdown: show months',
      description: 'Show the months cell on the dashboard countdown widget.',
      default: false,
    },
    countdown_show_weeks: {
      type: 'boolean',
      label: 'Countdown: show weeks',
      description: 'Show the weeks cell on the dashboard countdown widget.',
      default: false,
    },
    countdown_show_days: {
      type: 'boolean',
      label: 'Countdown: show days',
      description: 'Show the days cell on the dashboard countdown widget.',
      default: true,
    },
    countdown_show_hours: {
      type: 'boolean',
      label: 'Countdown: show hours',
      description: 'Show the hours cell on the dashboard countdown widget.',
      default: true,
    },
    countdown_show_minutes: {
      type: 'boolean',
      label: 'Countdown: show minutes',
      description: 'Show the minutes cell on the dashboard countdown widget.',
      default: true,
    },
    countdown_show_seconds: {
      type: 'boolean',
      label: 'Countdown: show seconds',
      description:
        'Show the seconds cell on the dashboard countdown widget. Off by default to avoid the 1Hz repaint.',
      default: false,
    },
  },
  web: {
    icon: () => import('lucide-react').then((m) => m.CalendarHeart),
    basePath: '/events',
    routes: [
      {
        path: '',
        index: true,
        component: () =>
          import('./components/EventsHome').then((m) => m.EventsHome),
      },
    ],
    showInNav: true,
    navOrder: 4,
    section: 'Relationships',
    filters: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'tag', label: 'Tag', type: 'enum', multi: true },
    ],
    settingsWidget: () =>
      import('./components/EventsSettingsWidget').then(
        (m) => m.EventsSettingsWidget,
      ),
    widgets: [
      {
        id: 'events-countdown',
        label: 'Countdown',
        component: () =>
          import('./components/CountdownWidget').then((m) => m.CountdownWidget),
        order: 10,
      },
      {
        id: 'events-upcoming',
        label: 'Upcoming events',
        component: () =>
          import('./components/UpcomingEventsWidget').then(
            (m) => m.UpcomingEventsWidget,
          ),
        order: 20,
      },
    ],
  },
};
