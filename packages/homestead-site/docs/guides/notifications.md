# Notifications

This guide is for module authors who want their feature to send push
notifications to a user — and, optionally, read them back. It leads with the
usage you'll actually write.

## Prerequisite: VAPID keys

Push needs a VAPID keypair. Generate one per environment with `npx web-push
generate-vapid-keys`, then set the keys in `packages/homestead-app/.env` (copy
[`packages/homestead-app/.env.example`](https://github.com/rambleraptor/homestead/blob/main/packages/homestead-app/.env.example)
as a starting point):

```bash
# Public key — exposed to the browser so the service worker can subscribe.
VAPID_PUBLIC_KEY=<public-key>

# Server-side keys — used by the sidecar to sign pushes. Keep them secret.
VAPID_PRIVATE_KEY=<private-key>
VAPID_EMAIL=mailto:you@example.com
```

The public key is baked into the SPA bundle at build time (`make build` /
`make homestead` source `packages/homestead-app/.env`), so set it before you
build. Web push requires HTTPS (localhost is exempt).

## Mental model

Your module sends a notification with a single server-side helper. Homestead
handles delivery (signs and sends the web push to the user's devices) and
records the notification in that user's inbox so the UI can show it. The
notification always goes to the **calling** user. You don't manage push
subscriptions or inbox rows yourself.

## Sending a notification from your module

The server-side helper lives in
[`packages/homestead-core/server/notifications.ts`](https://github.com/rambleraptor/homestead/blob/main/packages/homestead-core/server/notifications.ts)
and is runtime-agnostic — it takes a standard web `Request`/auth and returns a
web `Response`, so it works under the sidecar's Hono routes and module custom
methods alike. It exposes two entry points:

```ts
import {
  sendUserNotification,    // authenticates the request, then sends
  sendNotificationForAuth, // caller already authenticated (module methods)
  type UserNotificationOptions,
} from '@rambleraptor/homestead-core/server/notifications';
```

`UserNotificationOptions` is:

```ts
interface UserNotificationOptions {
  title: string;             // notification title the user sees
  body: string;              // notification body text
  tag: string;               // stable id; repeated pushes with the same tag collapse
  url: string;               // path to open when the notification is clicked
  sourceCollection?: string; // aepbase plural this is about (e.g. 'people')
  sourceId?: string;         // record id, for the inbox icon + deep link
}
```

Two choices matter most:

- **`tag`** — use a stable value so repeated pushes collapse rather than stack
  (e.g. `'grocery-notification'`).
- **`sourceCollection` / `sourceId`** — set these so the inbox can pick the
  right icon and deep-link back to the record. `sourceCollection` is the
  aepbase plural (e.g. `'people'`, not `'person'`).

### From a module custom method (AEP-136)

Module-owned endpoints are **resource custom methods**, not standalone routes.
Declare a `customMethods` entry on the module's resource definition and
implement a handler; the sidecar's `/api/aep` gateway dispatches
`POST /api/aep/<plural>:<verb>` to it, after authenticating the caller. The
handler receives that already-authenticated caller, so it calls
`sendNotificationForAuth(auth, …)` directly.

The grocery "list updated" push is the canonical example
([`packages/homestead-modules/groceries/methods/send-notification.ts`](https://github.com/rambleraptor/homestead/blob/main/packages/homestead-modules/groceries/methods/send-notification.ts)):

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
([`packages/homestead-modules/groceries/resources.ts`](https://github.com/rambleraptor/homestead/blob/main/packages/homestead-modules/groceries/resources.ts)):

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
[`packages/homestead-modules/groceries/hooks/useSendGroceryNotification.ts`](https://github.com/rambleraptor/homestead/blob/main/packages/homestead-modules/groceries/hooks/useSendGroceryNotification.ts)).

### From a sidecar route (Hono)

If you own a core sidecar endpoint instead, it authenticates the incoming
request itself, so it calls `sendUserNotification(request, …)` with Hono's raw
`Request` (`c.req.raw`). The built-in test endpoint is the canonical example
([`packages/homestead-sidecar/src/routes/notifications.ts`](https://github.com/rambleraptor/homestead/blob/main/packages/homestead-sidecar/src/routes/notifications.ts)):

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

## Reading notifications

You usually don't need to render notifications in your module — link to
`/notifications`, the unified inbox. If you do want to read them, the
notifications module ships these hooks. Import them from their hook modules
under `@rambleraptor/homestead-modules/notifications/hooks/…`:

| Hook                              | Import                                                                  | Returns                                       |
|-----------------------------------|-------------------------------------------------------------------------|-----------------------------------------------|
| `useNotifications()`              | `@rambleraptor/homestead-modules/notifications/hooks/useNotifications`        | All notifications for the current user        |
| `useNotificationStats()`          | `@rambleraptor/homestead-modules/notifications/hooks/useNotificationStats`    | `{ total, unread, read }`                     |
| `useMarkNotificationAsRead()`     | `@rambleraptor/homestead-modules/notifications/hooks/useMarkNotificationAsRead` | Mutation, takes a notification id           |

Plus `useUnreadNotifications()` from the dashboard module
(`@rambleraptor/homestead-modules/dashboard/hooks/useUnreadNotifications`) for
a top-N inbox preview.

Each notification you read back carries `title` and `message` (what the user
sees), `read` / `read_at` (read state), and `source_collection` /
`source_id` (the record it's about, for icons and deep links). For a
module-scoped feed, query the notifications and filter client-side by
`source_collection === '<your-collection>'`.

## Adding notifications to a new module

1. Implement a custom-method handler under your module (e.g.
   `methods/send-notification.ts`) that exports a default
   `CustomMethodHandler` calling `sendNotificationForAuth(auth, { … })`.
2. Declare it on the relevant resource in your module's `resources.ts` via the
   `customMethods` map (`{ '<verb>': { target: 'collection', load: () =>
   import('./methods/<verb>') } }`). The schema sync registers it; the sidecar
   gateway then serves `POST /api/aep/<plural>:<verb>`.
3. Trigger it from the client with
   `aepbase.customMethod('<plural>', '<verb>')` (see
   [`useSendGroceryNotification.ts`](https://github.com/rambleraptor/homestead/blob/main/packages/homestead-modules/groceries/hooks/useSendGroceryNotification.ts)).
4. Decide on a stable `tag` so repeated pushes collapse rather than stack.
5. Set `sourceCollection` to your aepbase plural (e.g. `'people'`, not
   `'person'`) and `sourceId` to the record id, so the inbox can pick the
   right icon and deep-link.

## Testing

- **Unit:** mock `aepbase` (already done globally in
  `packages/homestead-app/src/test/setup.ts`) and assert your hook invokes
  `aepbase.customMethod(...)` (or your sidecar route invokes
  `sendNotificationForAuth`) with the right payload.
- **Manual smoke test:** with the dev stack running, `POST` to
  `/api/notifications/send-test` from the browser DevTools console (the
  Settings page wires this up via `useSendTestNotification`). You should
  see a push and a new row in your inbox.
