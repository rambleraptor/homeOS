import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';

export const EVENTS = 'events' as const;

export const eventsResources: ResourceDefinition[] = [
  {
    singular: 'event',
    plural: EVENTS,
    description:
      'A yearly-recurring event. Either a fixed month/day (default) or the Nth weekday of a month (e.g., second Sunday of May).',
    user_settable_create: true,
    fields: {
      name: { type: 'string', required: true },
      date: { type: 'string', format: 'date-time', required: true },
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
];
