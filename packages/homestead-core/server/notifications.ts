/**
 * Reusable utility for sending push notifications to an authenticated user.
 *
 * Handles VAPID configuration, subscription fetching, push delivery,
 * expired subscription cleanup, and inbox record creation (one row per send,
 * whether or not a push was delivered) — all against aepbase.
 *
 * Runtime-agnostic: returns a Web `Response`, so it works under Next, the
 * Bun sidecar, and app workers alike.
 */

import webpush from 'web-push';
import { authenticate, type AuthResult } from './aepbase';
import { serverClient } from './client';

interface NotificationSubscriptionRecord {
  id: string;
  subscription_data: webpush.PushSubscription;
  enabled: boolean;
}

export interface UserNotificationOptions {
  title: string;
  body: string;
  tag: string;
  url: string;
  sourceCollection?: string;
  sourceId?: string;
  /**
   * Restrict delivery to a single notification-subscription (device) by id.
   * Omit to deliver to every enabled subscription. Used by the settings
   * screen's per-device "send test" action.
   */
  subscriptionId?: string;
}

export async function sendUserNotification(
  request: Request,
  options: UserNotificationOptions,
): Promise<Response> {
  const auth = await authenticate(request);
  if (!auth) {
    return Response.json(
      { error: 'Unauthorized - authentication required' },
      { status: 401 },
    );
  }
  return sendNotificationForAuth(auth, options);
}

// App workers receive an already-authenticated caller from the
// dispatcher, so they call this directly instead of re-running
// `authenticate()` (which would issue a second `/users/{id}` round-trip).
export async function sendNotificationForAuth(
  auth: AuthResult,
  options: UserNotificationOptions,
): Promise<Response> {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@example.com';

  if (!vapidPublicKey || !vapidPrivateKey) {
    return Response.json({ error: 'VAPID keys not configured' }, { status: 500 });
  }
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

  const userId = auth.user.id;
  const hs = serverClient(auth.token);
  const userRecord = hs.collection('users').record(userId);

  let subscriptions: NotificationSubscriptionRecord[];
  try {
    subscriptions = await userRecord
      .collection<NotificationSubscriptionRecord>('notification-subscriptions')
      .listAll();
  } catch (error) {
    console.error('Failed to fetch subscriptions:', error);
    return Response.json(
      { error: 'Failed to fetch notification subscriptions' },
      { status: 500 },
    );
  }

  let enabledSubs = subscriptions.filter((sub) => sub.enabled === true);

  if (options.subscriptionId) {
    enabledSubs = enabledSubs.filter((sub) => sub.id === options.subscriptionId);
    if (enabledSubs.length === 0) {
      return Response.json({
        success: false,
        message:
          'That device is no longer registered for notifications. Please refresh and try again.',
        timestamp: new Date().toISOString(),
      });
    }
  }

  let sentCount = 0;
  let failedCount = 0;

  for (const sub of enabledSubs) {
    try {
      const payload = JSON.stringify({
        title: options.title,
        body: options.body,
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: options.tag,
        data: {
          url: options.url,
          sourceCollection: options.sourceCollection,
          sourceId: options.sourceId,
          timestamp: new Date().toISOString(),
        },
      });

      await webpush.sendNotification(sub.subscription_data, payload);
      sentCount++;
    } catch (error: unknown) {
      const err = error as { statusCode?: number };
      failedCount++;
      if (err.statusCode === 404 || err.statusCode === 410) {
        await userRecord
          .collection('notification-subscriptions')
          .record(sub.id)
          .delete()
          .catch(() => undefined);
      }
    }
  }

  // Record the notification in the user's inbox exactly once — regardless of
  // how many devices it reached, or whether any did. The inbox is the durable
  // record of what was sent; web push is best-effort delivery layered on top,
  // so a user with no (or only stale) subscriptions still sees the message.
  try {
    await userRecord.collection('notifications').create({
      user_id: userId,
      title: options.title,
      message: options.body,
      notification_type: 'system',
      source_collection: options.sourceCollection,
      source_id: options.sourceId,
      read: false,
      sent_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to record notification in inbox:', error);
    return Response.json(
      { error: 'Failed to record notification' },
      { status: 500 },
    );
  }

  const deviceCount = enabledSubs.length;
  let message: string;
  if (deviceCount === 0) {
    message = 'Saved to your inbox. No devices are subscribed for push notifications.';
  } else if (sentCount === 0) {
    message = `Saved to your inbox, but push delivery failed on all ${deviceCount} device(s).`;
  } else {
    message = `Notification sent to ${sentCount} of ${deviceCount} device(s) and saved to your inbox.`;
  }

  return Response.json({
    success: true,
    recorded: true,
    message,
    sent: sentCount,
    failed: failedCount,
    timestamp: new Date().toISOString(),
  });
}
