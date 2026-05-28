import { Hono } from 'hono';
import { sendUserNotification } from '@rambleraptor/homestead-core/server/notifications';

export const notificationsRoute = new Hono();

notificationsRoute.post('/send-test', (c) =>
  sendUserNotification(c.req.raw, {
    title: 'Test Notification',
    body: 'If you see this, push notifications are working!',
    tag: 'test-notification',
    url: '/notifications',
  }),
);
