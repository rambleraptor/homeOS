/**
 * `grocery-items:send-notification` custom method (AEP-136).
 *
 * Lives on the grocery collection; dispatched by the sidecar gateway as
 * `POST /api/aep/groceries:send-notification`. Sends a push notification to
 * the calling user advertising that the grocery list has been updated.
 */

import { sendNotificationForAuth } from '@rambleraptor/homestead-core/server/notifications';
import type { CustomMethodHandler } from '@rambleraptor/homestead-core/resources/types';

const handler: CustomMethodHandler = async ({ auth }) => {
  return sendNotificationForAuth(auth, {
    title: 'Grocery List Updated',
    body: 'The grocery list has been updated. Check it out!',
    tag: 'grocery-notification',
    url: '/groceries',
    sourceCollection: 'grocery_items',
  });
};

export default handler;
