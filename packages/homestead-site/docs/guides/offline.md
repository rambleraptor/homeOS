# Offline Support

Homestead apps keep working when the network drops. Reads serve the last data
you saw, writes apply instantly and queue, and everything syncs to the server
when the connection returns. If you build your app the standard way — resources
plus the [standard data hooks](./state-management) — you get this for free, with
no offline code to write.

This page covers:

- [What you get for free](#what-you-get-for-free) — the default behavior.
- [Show offline state in your UI](#show-offline-state-in-your-ui) — the banner and status hook.
- [Disable actions that need the network](#disable-actions-that-need-the-network).
- [Handle file uploads](#handle-file-uploads) — the one thing that doesn't queue.
- [Customize per resource](#customize-per-resource) — cascade deletes and opt-out.
- [Reference](#reference).

---

## What you get for free

Any resource you read and write through the standard hooks is offline-ready
the moment you define it. No setup, no flags.

While offline:

- **Reads return cached data.** A `useQuery` (or a hook like `useGiftCards`)
  serves whatever it last loaded instead of failing.
- **Writes apply immediately.** A create, update, or delete updates the screen
  right away, then waits in a queue.
- **The queue drains on reconnect.** Queued writes replay in order, oldest
  first, and the affected lists refetch so the screen matches the server.
- **A failed write rolls back.** If the server rejects a queued write when it
  finally runs, the optimistic change is undone.

The cache survives a page reload, too. A user can close the tab on the subway,
reopen it still underground, and see their data (kept for up to 7 days).

You opt into all of this by using the standard write hooks from
[State Management](./state-management#data-hooks):

```ts
import { useResourceCreate } from '@rambleraptor/homestead-core/api/resourceHooks';

export const useCreateGiftCard = () =>
  useResourceCreate<GiftCard, GiftCardFormData>('gift-cards', 'gift-card');
```

These hooks carry the offline behavior for you. The only requirement is the
**mutation key** — `('<appId>', '<singular>')`, which `useResourceCreate`,
`useResourceUpdate`, and `useResourceDelete` set automatically.

If you hand-write a `useMutation` (for file handling or a multi-step write),
match that key to inherit the same offline queue:

```ts
import { useMutation } from '@tanstack/react-query';
import { resourceMutationKeys } from '@rambleraptor/homestead-core/api/registerResourceMutationDefaults';

const keys = resourceMutationKeys('gift-cards', 'gift-card');

useMutation({ mutationKey: keys.create /* , ...your overrides */ });
```

A `useMutation` with no matching key is **not** offline-aware: it will fail
outright when there's no network.

---

## Show offline state in your UI

A global banner already tells users when they're offline — **"You are offline.
Changes will sync when you reconnect."** — pinned to the bottom of every screen.
It's part of the app shell, so you don't add it yourself.

When you need the offline state inside a component, use `useOnlineStatus`:

```tsx
import { useOnlineStatus } from '@rambleraptor/homestead-core/shared/hooks/useOnlineStatus';

function SyncHint() {
  const { isOffline } = useOnlineStatus();
  if (!isOffline) return null;
  return <p>Saved on this device — will sync when you're back online.</p>;
}
```

It returns `{ isOnline, isOffline }` and re-renders the moment the connection
changes.

---

## Disable actions that need the network

Some actions can't be queued because they have no offline meaning — sending a
test notification, running a chat request, kicking off a server job. Disable
those controls while offline so users don't trigger a guaranteed failure:

```tsx
const { isOffline } = useOnlineStatus();

<button
  disabled={isOffline}
  title={isOffline ? 'Available when you reconnect' : undefined}
>
  Send test notification
</button>
```

Regular create/update/delete buttons do **not** need this — they queue and
sync on their own.

---

## Handle file uploads

Writes that send a file (anything using `FormData`, such as a resource with a
[file field](./resources)) are **not** queued offline. A file upload needs the
network and fails when there isn't one.

Guard any upload path with the online check:

```tsx
const { isOffline } = useOnlineStatus();

<button disabled={isOffline}>Upload receipt</button>
```

Text-only writes on the same resource still queue normally — only the
file-carrying write is online-only.

---

## Customize per resource

The default offline behavior fits standard CRUD. When a resource needs
something different, declare it in your app's `app.config.ts` under
`offlineOverrides`, keyed by the resource's `singular`.

**Cascade a delete.** When deleting one record should also fix up related
records offline (for example, deleting a store clears the `store` field on its
items), point the resource at a `cascadeDelete` handler:

```ts
// packages/homestead-apps/groceries/app.config.ts
offlineOverrides: {
  store: {
    cascadeDelete: () => import('./offline').then((m) => m.storeCascadeDelete),
  },
}
```

**Opt a resource out.** If a resource has bespoke write logic that the default
offline queue shouldn't touch, set it to `false`:

```ts
offlineOverrides: {
  perk: false,
  redemption: false,
}
```

An opted-out resource has no automatic offline queue — its writes need the
network unless you wire your own.

---

## Reference

| Item | Import | Use |
|------|--------|-----|
| `useResourceCreate` / `useResourceUpdate` / `useResourceDelete` | `@rambleraptor/homestead-core/api/resourceHooks` | Offline-ready CRUD hooks |
| `resourceMutationKeys(appId, singular)` | `@rambleraptor/homestead-core/api/registerResourceMutationDefaults` | Mutation keys for a hand-written `useMutation` |
| `useOnlineStatus()` | `@rambleraptor/homestead-core/shared/hooks/useOnlineStatus` | `{ isOnline, isOffline }`, reactive |
| `<OfflineBanner />` | (in the app shell) | Global offline banner — already mounted |
| `offlineOverrides` | `app.config.ts` | Per-resource `cascadeDelete` or `false` to opt out |

**Offline behavior at a glance:**

| Action offline | What happens |
|----------------|--------------|
| Read a resource | Serves cached data (kept up to 7 days, survives reload) |
| Create / update / delete | Applies on screen, queues, syncs on reconnect (oldest first) |
| Queued write rejected by server | Optimistic change rolls back |
| Upload a file | Fails — uploads are online-only |
| Action with no offline meaning | You disable it via `useOnlineStatus` |
