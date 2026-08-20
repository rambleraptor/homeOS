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
        enum: ['day_of', 'day_before', 'week_before', 'reminder', 'system'],
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
      device_label: {
        type: 'string',
        description:
          'Human-readable name for the device this subscription belongs to (e.g. "Chrome on macOS").',
      },
    },
    // POST /api/aep/notification-subscriptions/{id}:send-notification — push a
    // notification to this one device (defaults to a test notification when the
    // body is omitted).
    customMethods: {
      'send-notification': {
        target: 'item',
        description:
          'Send a push notification to this one device and record one inbox row. With no body, sends a test notification.',
        request: {
          type: 'object',
          description:
            'Optional overrides; omit the body entirely to send a test notification.',
          properties: {
            title: {
              type: 'string',
              description: 'Notification title (default: "Test Notification").',
            },
            body: { type: 'string', description: 'Notification body text.' },
            tag: {
              type: 'string',
              description:
                'Collapse key; same-tag pushes replace each other (default: "device-test").',
            },
            url: {
              type: 'string',
              description:
                'Path opened when the notification is clicked (default: "/notifications").',
            },
            sourceCollection: {
              type: 'string',
              description:
                'aepbase plural the notification is about (e.g. "recipes").',
            },
            sourceId: {
              type: 'string',
              description: 'Record id the notification is about.',
            },
          },
        },
        response: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            recorded: {
              type: 'boolean',
              description: 'Whether the inbox row was written.',
            },
            message: { type: 'string' },
            sent: { type: 'integer', description: 'Devices the push reached.' },
            failed: {
              type: 'integer',
              description: 'Devices the push failed on.',
            },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        load: () => import('./methods/send-notification'),
      },
    },
  },
];
