import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';

export const GARBAGE_PICKUPS = 'garbage-pickups' as const;

/**
 * Waste streams a pickup can belong to. Mirrors the hauler-side stream codes
 * (WM returns GARBAGE / RECYCLABLE / YARD_WASTE / ORGANIC / BULK / HAZARDOUS)
 * lowercased into the kebab-case aepbase enums want.
 */
export const GARBAGE_STREAMS = [
  'garbage',
  'recyclable',
  'yard-waste',
  'organic',
  'bulk',
  'hazardous',
] as const;

export const homeResources: ResourceDefinition[] = [
  {
    singular: 'garbage-pickup',
    plural: GARBAGE_PICKUPS,
    description:
      'One collection day for one waste stream. Garbage, recycling, and yard waste run on separate schedules, so a single calendar day is several records. Rows are normally written by an external sync (see `source`), but a household member can add one by hand.',
    user_settable_create: true,
    fields: {
      pickup_date: {
        type: 'string',
        format: 'date',
        required: true,
        description:
          'the day of collection as ISO YYYY-MM-DD, already holiday-adjusted. A plain date, not a timestamp — a pickup is a day, not an instant, and ISO dates sort lexically so order_by works.',
      },
      stream: {
        type: 'string',
        enum: GARBAGE_STREAMS,
        required: true,
        description: 'which waste stream is collected on this date',
      },
      status: {
        type: 'string',
        enum: ['scheduled', 'delayed'],
        default: 'scheduled',
        description:
          'delayed means a holiday pushed this pickup back; `original_date` holds the day it would otherwise have fallen on',
      },
      original_date: {
        type: 'string',
        format: 'date',
        description:
          'the pre-shift date when status is delayed; unset for a normal pickup',
      },
      note: {
        type: 'string',
        description:
          'short human explanation, e.g. "Thanksgiving — 1 day delay"',
      },
      service_description: {
        type: 'string',
        description:
          "the hauler's name for the service behind this pickup, e.g. \"96 Gallon Toter Recycle Limited\"",
      },
      // Distinguishes rows an automated sync owns from ones a person typed in.
      // The sync reconciles (and prunes) only its own rows, so a hand-entered
      // bulk-item pickup is never clobbered by the next run.
      source: {
        type: 'string',
        enum: ['manual', 'wm'],
        default: 'manual',
        description:
          'who wrote this row: `manual` (a household member) or a hauler sync such as `wm`',
      },
    },
  },
];
