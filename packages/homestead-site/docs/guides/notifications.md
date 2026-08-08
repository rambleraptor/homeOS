# Notifications

Send push notifications from your app to a user, and optionally read them back.
Homestead signs and delivers the web push to the user's devices and records it
in their inbox. A notification always goes to the **calling** user — you don't
manage push subscriptions or inbox rows yourself.

This page covers:

- [Set up VAPID keys](#set-up-vapid-keys)
- [Send a notification](#send-a-notification)
- [Send from a custom method](#send-from-a-custom-method)
- [Send from a server route](#send-from-a-server-route)
- [Send to a specific device](#send-to-a-specific-device)
- [Read notifications](#read-notifications)
- [Add notifications to a new app](#add-notifications-to-a-new-app)
- [Test notifications](#test-notifications)

---

## Set up VAPID keys

Push needs a VAPID keypair. Generate one per environment:

```bash
npx web-push generate-vapid-keys
```

Set the keys in `packages/homestead-app/.env` (copy
[`.env.example`](https://github.com/rambleraptor/homestead/blob/main/packages/homestead-app/.env.example)
to start):

```bash
VAPID_PUBLIC_KEY=<public-key>
VAPID_PRIVATE_KEY=<private-key>
VAPID_EMAIL=mailto:you@example.com
```

The browser uses the public key to subscribe; the server uses both keys to sign
pushes. Keep `VAPID_PRIVATE_KEY` secret.

Set the keys before you build: `make build` and `make homestead` bake the
public key into the SPA bundle. Web push requires HTTPS (localhost is exempt).

---

## Send a notification

Call one server-side helper from
[`packages/homestead-core/server/notifications.ts`](https://github.com/rambleraptor/homestead/blob/main/packages/homestead-core/server/notifications.ts).
It returns a web `Response`, so it works in both server routes and app custom
methods. There are two entry points:

```ts
import {
  sendUserNotification,    // authenticates the request, then sends
  sendNotificationForAuth, // caller already authenticated (app methods)
  type UserNotificationOptions,
} from '@rambleraptor/homestead-core/server/notifications';
```

Both take a `UserNotificationOptions`:

| Field              | Required | Description                                                       |
|--------------------|----------|-------------------------------------------------------------------|
| `title`            | yes      | Notification title the user sees                                  |
| `body`             | yes      | Notification body text                                            |
| `tag`              | yes      | Stable id; pushes with the same tag collapse instead of stacking  |
| `url`              | yes      | Path to open when the notification is clicked                     |
| `sourceCollection` | no       | aepbase plural this is about (e.g. `'people'`), for icon + link   |
| `sourceId`         | no       | Record id, for the inbox icon and deep link                       |

Use a stable `tag` (e.g. `'grocery-notification'`) so repeated pushes replace
each other. Set `sourceCollection` to the aepbase plural — `'people'`, not
`'person'`.

---

## Send from a custom method

Use this when the notification comes from your app. App endpoints are resource
custom methods (AEP-136): you declare them on a resource and the server's
`/api/aep` gateway serves `POST /api/aep/<plural>:<verb>`, authenticating the
caller first. Your handler receives the authenticated caller and passes it to
`sendNotificationForAuth(auth, …)`.

Write the handler. The grocery "list updated" push is the working example
([`packages/homestead-apps/groceries/methods/send-notification.ts`](https://github.com/rambleraptor/homestead/blob/main/packages/homestead-apps/groceries/methods/send-notification.ts)):

```ts
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
```

Wire it into the collection's resource definition via `customMethods`
([`packages/homestead-apps/groceries/resources.ts`](https://github.com/rambleraptor/homestead/blob/main/packages/homestead-apps/groceries/resources.ts)):

```ts
customMethods: {
  'send-notification': {
    target: 'collection',
    load: () => import('./methods/send-notification'),
  },
},
```

Trigger it from the client with `aepbase.customMethod('<plural>', '<verb>')`
(see
[`useSendGroceryNotification.ts`](https://github.com/rambleraptor/homestead/blob/main/packages/homestead-apps/groceries/hooks/useSendGroceryNotification.ts)).

---

## Send from a server route

Use this when you own a core server endpoint instead of an app method. The
route authenticates the request itself, so it calls
`sendUserNotification(request, …)` with Hono's raw `Request` (`c.req.raw`). The
built-in test endpoint is the working example
([`packages/homestead-server/src/routes/notifications.ts`](https://github.com/rambleraptor/homestead/blob/main/packages/homestead-server/src/routes/notifications.ts)):

```ts
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
```

---

## Send to a specific device

Each registered device is a `notification-subscription` record, and carries an
item-target custom method (AEP-136) that pushes to that one device:

```
POST /api/aep/notification-subscriptions/{id}:send-notification
```

The caller is resolved from auth, so the addressed id is all that's needed —
the user-parented form
(`/api/aep/users/{user-id}/notification-subscriptions/{id}:send-notification`)
works too. Because it's a standard AEP custom method (not a bespoke route),
it's reachable from anything that speaks the engine — the CLI, scripts, `curl`
— and it's described in the OpenAPI doc (`/api/aep/openapi.json`) with its
request and response schemas:

```bash
# Bare POST → sends a test notification to that device
curl -X POST "$HOMESTEAD_URL/api/aep/notification-subscriptions/$DEVICE_ID:send-notification" \
  -H "Authorization: Bearer $TOKEN"

# Or pass a JSON body to send real content
curl -X POST "$HOMESTEAD_URL/api/aep/notification-subscriptions/$DEVICE_ID:send-notification" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{ "title": "Dinner", "body": "Roast is ready", "url": "/recipes/42" }'
```

The body is optional and mirrors `UserNotificationOptions` (`title`, `body`,
`tag`, `url`, `sourceCollection`, `sourceId`); with no body it sends a test
notification. Delivery is restricted to the addressed device, and — like every
send — one inbox row is recorded. List a user's device ids with
`GET /api/aep/users/{user-id}/notification-subscriptions`.

From the client, invoke it with
`aepbase.customMethod('notification-subscriptions', 'send-notification', body, { id })`.

---

## Read notifications

Most apps don't render notifications — link to `/notifications`, the shared
inbox, instead. To read them in your app, use these hooks:

| Hook                              | Import                                                                  | Returns                                       |
|-----------------------------------|-------------------------------------------------------------------------|-----------------------------------------------|
| `useNotifications()`              | `@rambleraptor/homestead-core/notifications/hooks/useNotifications`        | All notifications for the current user        |
| `useNotificationStats()`          | `@rambleraptor/homestead-core/notifications/hooks/useNotificationStats`    | `{ total, unread, read }`                     |
| `useMarkNotificationAsRead()`     | `@rambleraptor/homestead-core/notifications/hooks/useMarkNotificationAsRead` | Mutation, takes a notification id           |

For a top-N inbox preview, use `useUnreadNotifications()` from
`@rambleraptor/homestead-core/dashboard/hooks/useUnreadNotifications`.

Each notification carries `title` and `message` (what the user sees), `read`
and `read_at` (read state), and `source_collection` and `source_id` (the
record it's about). For an app-scoped feed, read the notifications and filter
client-side by `source_collection === '<your-collection>'`.

---

## Add notifications to a new app

1. Write a custom-method handler under your app (e.g.
   `methods/send-notification.ts`) that default-exports a `CustomMethodHandler`
   calling `sendNotificationForAuth(auth, { … })`.
2. Declare it on a resource in your app's `resources.ts` `customMethods` map:

   ```ts
   customMethods: {
     'send-notification': {
       target: 'collection',
       load: () => import('./methods/send-notification'),
     },
   },
   ```

   On boot, the server serves it at `POST /api/aep/<plural>:<verb>`.
3. Trigger it from the client with `aepbase.customMethod('<plural>', '<verb>')`
   (see
   [`useSendGroceryNotification.ts`](https://github.com/rambleraptor/homestead/blob/main/packages/homestead-apps/groceries/hooks/useSendGroceryNotification.ts)).
4. Use a stable `tag` so repeated pushes replace each other.
5. Set `sourceCollection` to your aepbase plural (`'people'`, not `'person'`)
   and `sourceId` to the record id.

---

## Test notifications

Write a unit test: mock `aepbase` (done globally in
`packages/homestead-app/src/test/setup.ts`) and assert your hook calls
`aepbase.customMethod(...)` — or your server route calls
`sendNotificationForAuth` — with the right payload.

Run a manual smoke test: with the dev stack running, `POST` to
`/api/notifications/send-test` from the browser DevTools console. (The Settings
page wires this up via `useSendTestNotification`.) You see a push and a new row
in your inbox.

By default the test goes to every device the user has registered. To target a
single device, send its `notification-subscription` id in the body:

```json
{ "subscriptionId": "<notification-subscription-id>" }
```

The Settings screen lists each registered device (by a friendly label derived
from its user agent) and uses this to send a test to — or deregister — one
device at a time.
