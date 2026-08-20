import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';

export const EVENTS = 'events' as const;
export const EVENT_REMINDERS = 'event-reminders' as const;
export const REMINDERS = 'reminders' as const;

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
  {
    // A standalone reminder: a titled thing with a due instant, owned by the
    // household. Unrelated to `event-reminder` above, which is one user's
    // notification preference *for an event* — this is the thing itself, with
    // nowhere else in Homestead to live (an event recurs yearly; a todo has no
    // date at all).
    //
    // Deliberately narrow for now. No `recurrence` field: the design's open
    // question is whether recurrence counts from a fixed date or from the last
    // completion (home maintenance needs the latter), and shipping the wrong
    // enum first would cost a migration. No `source_collection`/`source_id`
    // either — those describe reminders derived from another app's records,
    // which nothing raises yet.
    singular: 'reminder',
    plural: REMINDERS,
    description:
      'A standalone reminder: something to be told about at a specific time. Not tied to an event.',
    user_settable_create: true,
    // Some reminders are the household's ("bins out tonight"), some are one
    // person's ("buy her birthday present"). Rather than fork into two
    // resources the way todos did, each row carries its own visibility and the
    // household role's grant is filtered to the shared value. See
    // packages/homestead-site/docs/design/record-visibility.md.
    access: {
      model: 'per-record',
      field: 'visibility',
      sharedValue: 'household',
      privateValue: 'private',
    },
    fields: {
      title: { type: 'string', required: true },
      notes: { type: 'string' },
      due_at: {
        type: 'string',
        format: 'date-time',
        required: true,
        description: 'when the reminder is due, as an RFC3339 instant',
      },
      status: {
        type: 'string',
        // Only the two states the UI can actually produce. The design sketched
        // a third (`dismissed`) with no control behind it; a vocabulary nothing
        // emits is the mistake `notification_type.day_before` already made here,
        // and adding an enum value later is a safe PATCH.
        enum: ['pending', 'done'],
        default: 'pending',
        description: 'pending until someone marks it done',
      },
      visibility: {
        type: 'string',
        enum: ['private', 'household'],
        default: 'household',
        // Decided when the reminder is created and never after: a mutable
        // discriminator would let anyone with write access hide a household
        // row from the household. To change it, delete and recreate.
        immutable: true,
        description: 'who can see this: just its owner, or the whole household',
      },
      created_by: { type: 'string', reference: { resource: 'user' } },
    },
  },
];
