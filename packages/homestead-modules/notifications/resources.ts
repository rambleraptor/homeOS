import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';
// Plural identifiers live in core so core-side hooks (push subscription
// management) can reach them without depending on this module. We re-export
// from here so module-local code has a single import surface.
import {
  NOTIFICATIONS,
  NOTIFICATION_SUBSCRIPTIONS,
} from '@rambleraptor/homestead-core/notifications/constants';

export { NOTIFICATIONS, NOTIFICATION_SUBSCRIPTIONS };

export const notificationsResources: ResourceDefinition[] = [
  {
    singular: 'notification',
    plural: NOTIFICATIONS,
    description: 'A notification delivered (or scheduled) to a user.',
    user_settable_create: true,
    parents: ['user'],
    schema: {
      type: 'object',
      properties: {
        person_id: {
          type: 'string',
          description: 'deprecated, use source_* fields',
        },
        title: { type: 'string' },
        message: { type: 'string' },
        notification_type: {
          type: 'string',
          description: 'one of: day_of, day_before, week_before, system',
        },
        scheduled_for: { type: 'string', format: 'date-time' },
        sent_at: { type: 'string', format: 'date-time' },
        read: { type: 'boolean' },
        read_at: { type: 'string', format: 'date-time' },
        source_collection: { type: 'string' },
        source_id: { type: 'string' },
      },
      required: ['title', 'message', 'notification_type'],
    },
  },
  {
    singular: 'notification-subscription',
    plural: NOTIFICATION_SUBSCRIPTIONS,
    description: 'A web push subscription endpoint for a user.',
    user_settable_create: true,
    parents: ['user'],
    schema: {
      type: 'object',
      properties: {
        subscription_data: { type: 'object' },
        enabled: { type: 'boolean' },
      },
      required: ['subscription_data'],
    },
  },
];
