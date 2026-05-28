/**
 * Groceries `send-grocery-notification` worker.
 *
 * Mounted at `POST /api/modules/groceries/send-grocery-notification`.
 * Sends a push notification to the calling user advertising that the
 * grocery list has been updated.
 */

import { sendNotificationForAuth } from '@rambleraptor/homestead-core/server/notifications';
import type { ModuleWorkerHandler } from '@rambleraptor/homestead-core/modules/types';

const handler: ModuleWorkerHandler = async ({ auth }) => {
  if (!auth) {
    return Response.json(
      { error: 'Unauthorized - authentication required' },
      { status: 401 },
    );
  }
  return sendNotificationForAuth(auth, {
    title: 'Grocery List Updated',
    body: 'The grocery list has been updated. Check it out!',
    tag: 'grocery-notification',
    url: '/groceries',
    sourceCollection: 'grocery_items',
  });
};

export default handler;
