import { Hono } from 'hono';
import { sendUserNotification } from '@rambleraptor/homestead-core/server/notifications';

export const notificationsRoute = new Hono();

notificationsRoute.post('/send-test', async (c) => {
  // Optional: target a single device. Body may be absent or non-JSON.
  let subscriptionId: string | undefined;
  try {
    const body = (await c.req.json()) as { subscriptionId?: unknown };
    if (typeof body?.subscriptionId === 'string') {
      subscriptionId = body.subscriptionId;
    }
  } catch {
    // no/!JSON body → send to all devices
  }

  return sendUserNotification(c.req.raw, {
    title: 'Test Notification',
    body: 'If you see this, push notifications are working!',
    tag: 'test-notification',
    url: '/notifications',
    subscriptionId,
  });
});
