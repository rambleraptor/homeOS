import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';
// Plural identifiers live in core so core-side hooks (push subscription
// management) can reach them without depending on this app. We re-export
// from here so app-local code has a single import surface.
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
    fields: {
      person_id: {
        type: 'string',
        description: 'deprecated, use source_* fields',
      },
      title: { type: 'string', required: true },
      message: { type: 'string', required: true },
      notification_type: {
        type: 'string',
        enum: ['day_of', 'day_before', 'week_before', 'system'],
        required: true,
      },
      scheduled_for: { type: 'string', format: 'date-time' },
      sent_at: { type: 'string', format: 'date-time' },
      read: { type: 'boolean' },
      read_at: { type: 'string', format: 'date-time' },
      source_collection: { type: 'string' },
      source_id: { type: 'string' },
    },
  },
  {
    singular: 'notification-subscription',
    plural: NOTIFICATION_SUBSCRIPTIONS,
    description: 'A web push subscription endpoint for a user.',
    user_settable_create: true,
    parents: ['user'],
    fields: {
      subscription_data: { type: 'object', required: true },
      enabled: { type: 'boolean' },
    },
  },
];
