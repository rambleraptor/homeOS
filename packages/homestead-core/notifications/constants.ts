/**
 * Plural identifiers for the notification resources.
 *
 * These live in core (rather than the notifications app) because core
 * hooks (`useNotificationSubscription`, etc.) need to manage push
 * subscriptions for the authenticated user, and core can't depend on
 * a feature app. The notifications app re-exports these from its
 * `resources.ts` so app-local code still has one source of truth.
 */
export const NOTIFICATIONS = 'notifications' as const;
export const NOTIFICATION_SUBSCRIPTIONS = 'notification-subscriptions' as const;
