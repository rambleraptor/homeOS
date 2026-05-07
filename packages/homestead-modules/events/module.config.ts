/**
 * Events Module Configuration
 *
 * Yearly-recurring household events (birthdays, anniversaries, …).
 * Source of truth for the dashboard's upcoming-events widget.
 */

import { CalendarHeart } from 'lucide-react';
import type { HomeModule } from '@/modules/types';
import { EventsHome } from './components/EventsHome';
import { UpcomingEventsWidget } from './components/UpcomingEventsWidget';
import { CountdownWidget } from './components/CountdownWidget';
import { CountdownConfigRoute } from './components/CountdownConfigRoute';
import { eventsResources } from './resources';

export const eventsModule: HomeModule = {
  id: 'events',
  name: 'Events',
  description: 'Track yearly-recurring household events',
  icon: CalendarHeart,
  basePath: '/events',
  routes: [
    { path: '', index: true, component: EventsHome },
    { path: 'countdown', component: CountdownConfigRoute },
  ],
  showInNav: true,
  navOrder: 4,
  section: 'Relationships',
  enabled: true,
  resources: eventsResources,
  flags: {
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
  widgets: [
    {
      id: 'events-countdown',
      label: 'Countdown',
      component: CountdownWidget,
      order: 10,
    },
    {
      id: 'events-upcoming',
      label: 'Upcoming events',
      component: UpcomingEventsWidget,
      order: 20,
    },
  ],
};
