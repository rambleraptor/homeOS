import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';

export const EVENTS = 'events' as const;
export const EVENT_REMINDERS = 'event-reminders' as const;

export const eventsResources: ResourceDefinition[] = [
  {
    singular: 'event',
    plural: EVENTS,
    description:
      'A yearly-recurring event. Either a fixed month/day (default) or the Nth weekday of a month (e.g., second Sunday of May). The year is optional — supply it (birth year, wedding year) to show an age / anniversary count.',
    user_settable_create: true,
    fields: {
      name: { type: 'string', required: true },
      month: { type: 'number', required: true, description: 'month of the event, 1-12' },
      day: { type: 'number', required: true, description: 'day of the month, 1-31' },
      year: {
        type: 'number',
        description:
          'optional origin year (birth year / wedding year); when set, drives the age / anniversary count',
      },
      // Deprecated: the legacy single date-time field. Superseded by
      // month/day/year. Kept (optional) only so the `events-split-date`
      // migration can read it off existing rows; removed in a follow-up once
      // that migration has run everywhere. New records never write it.
      date: { type: 'string', format: 'date-time', description: 'deprecated; use month/day/year' },
      tag: {
        type: 'string',
        description: 'free-form; common values: birthday, anniversary',
      },
      people: {
        type: 'array',
        items: { type: 'string', reference: { resource: 'person' } },
      },
      recurrence: {
        type: 'string',
        enum: ['yearly', 'yearly-nth-weekday'],
        description: 'defaults to yearly',
      },
      recurrence_rule: {
        type: 'string',
        description:
          "for yearly-nth-weekday: '<n>:<weekday>' where n is 1..4 or -1 (last) and weekday is 0=Sun..6=Sat. Month comes from `date`. Example: '2:0' = 2nd Sunday.",
      },
      created_by: { type: 'string', reference: { resource: 'user' } },
    },
  },
  {
    // One user's reminder preference for a single event. Parented under `user`
    // so each household member's choices are private and independently scoped —
    // the same event can be a week-before reminder for one person and nothing
    // for another. The absence of a record means "no reminder" (the default),
    // so we only ever store rows a user actively opted into. `cascade` cleans
    // every user's rows for an event when that event is deleted.
    singular: 'event-reminder',
    plural: EVENT_REMINDERS,
    description:
      "One user's reminder preference for a single recurring event. Absence of a record means no reminder.",
    user_settable_create: true,
    parents: ['user'],
    fields: {
      event_id: {
        type: 'string',
        required: true,
        reference: { resource: 'event', onDelete: 'cascade' },
      },
      lead: {
        type: 'string',
        enum: ['day_of', 'week_before', 'both'],
        required: true,
        description:
          'when to notify: day_of (morning of), week_before (7 days ahead), or both',
      },
    },
  },
];
