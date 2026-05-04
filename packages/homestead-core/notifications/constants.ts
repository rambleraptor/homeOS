/**
 * Plural identifiers for the notification resources.
 *
 * These live in core (rather than the notifications module) because core
 * hooks (`useNotificationSubscription`, etc.) need to manage push
 * subscriptions for the authenticated user, and core can't depend on
 * a feature module. The notifications module re-exports these from its
 * `resources.ts` so module-local code still has one source of truth.
 */
export const NOTIFICATIONS = 'notifications' as const;
export const NOTIFICATION_SUBSCRIPTIONS = 'notification-subscriptions' as const;
