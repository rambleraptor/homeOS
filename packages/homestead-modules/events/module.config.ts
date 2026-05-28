/**
 * Events Module Configuration
 *
 * Yearly-recurring household events (birthdays, anniversaries, …).
 * Source of truth for the dashboard's upcoming-events widget.
 */

import type { HomeModule } from '@rambleraptor/homestead-core/modules/types';
import { eventsResources } from './resources';

export const eventsModule: HomeModule = {
  id: 'events',
  name: 'Events',
  description: 'Track yearly-recurring household events',
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
  enabled: true,
  resources: eventsResources,
  filters: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'tag', label: 'Tag', type: 'enum', multi: true },
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
};
