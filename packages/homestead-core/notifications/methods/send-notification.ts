/**
 * `notification-subscription:send` custom method (AEP-136), item-target.
 *
 * Dispatched by the sidecar gateway as
 * `POST /api/aep/notification-subscriptions/{id}:send` (the user-parented form
 * `POST /api/aep/users/{uid}/notification-subscriptions/{id}:send` works too —
 * the caller is resolved from auth, so the addressed id is all that matters).
 *
 * Sends a push notification to a *single* device — the addressed
 * notification-subscription — and records one inbox row, via
 * `sendNotificationForAuth`'s `subscriptionId` filter. With no body it sends a
 * test notification, so a bare CLI/curl POST is a one-device smoke test; pass a
 * JSON body to send real content.
 */

import { sendNotificationForAuth } from '@rambleraptor/homestead-core/server/notifications';
import type { CustomMethodHandler } from '@rambleraptor/homestead-core/resources/types';

interface SendToDeviceBody {
  title?: string;
  body?: string;
  tag?: string;
  url?: string;
  sourceCollection?: string;
  sourceId?: string;
}

const handler: CustomMethodHandler = async ({ auth, id, request }) => {
  if (!id) {
    return Response.json(
      { error: 'A notification-subscription (device) id is required' },
      { status: 400 },
    );
  }

  // Body is optional: default to a test notification so a bare POST works.
  let payload: SendToDeviceBody = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === 'object') {
      payload = parsed as SendToDeviceBody;
    }
  } catch {
    // No/non-JSON body → send the default test notification.
  }

  return sendNotificationForAuth(auth, {
    title: payload.title ?? 'Test Notification',
    body:
      payload.body ??
      'If you see this, push notifications are working on this device!',
    tag: payload.tag ?? 'device-test',
    url: payload.url ?? '/notifications',
    sourceCollection: payload.sourceCollection,
    sourceId: payload.sourceId,
    subscriptionId: id,
  });
};

export default handler;
