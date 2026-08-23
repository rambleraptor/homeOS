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
    // RETIRED — kept only so `notifications-adopt-reminders` has a collection to
    // read. Nothing writes it, nothing renders it, and nothing delivers from it.
    //
    // A reminder is a `scheduled-notification` now: one row per recipient under
    // the user it addresses, delivered by the notifications app's dispatcher.
    // See packages/homestead-site/docs/design/scheduled-notifications.md.
    //
    // **Do not remove this definition until the adoption migration has run
    // everywhere it needs to.** Removing it drops the table, and the engine's
    // column guard won't help — dropping the whole definition takes the data
    // with it, and the migration reads that data. When it goes, it goes with a
    // migration declaring the drop (implying `destructive`), per CLAUDE.md's
    // two-release rule. Everything below is frozen as it was; it exists to be
    // read once and then deleted.
    singular: 'reminder',
    plural: REMINDERS,
    description:
      'Retired. Superseded by scheduled-notification; retained until the adoption migration has run.',
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
      // Set only on a reminder an app raised on the household's behalf: the id
      // of that app (`events`, `home`, …). Absent means a person typed it in.
      // The reminders tab hides typed rows by default — an app that materializes
      // one reminder per pickup day would otherwise bury the handful someone
      // actually wrote — and the notify cron uses it to pick the app's basePath
      // for the notification's click-through.
      type: {
        type: 'string',
        description:
          'id of the app that raised this reminder; unset for one a person created',
      },
      // The creating app's idempotency key for this reminder, unique within the
      // app (`<event id>:<lead>:<year>`, `pickup:<date>`, …). A materializer
      // runs daily over an overlapping horizon, so it needs to recognise the
      // rows it already wrote; the key is opaque to everything else. Deliberately
      // not a `reference` — a key is often a record id, but it's just as often a
      // date or a compound of both.
      source_key: {
        type: 'string',
        description:
          'stable per-app key identifying what this reminder was raised from',
      },
      // Who gets notified. Empty means everyone who can see the reminder: its
      // owner for a private row, the whole household for a shared one. Apps that
      // materialize from a per-user preference (event reminders) narrow it to
      // the people who actually opted in, without making the row itself private —
      // a private row created by a cron would be owned by the cron, not by them.
      notify_users: {
        type: 'array',
        description:
          'users to notify; empty means everyone who can see the reminder',
        items: { type: 'string', reference: { resource: 'user' } },
      },
    },
  },
];
