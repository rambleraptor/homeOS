# State Management

Homestead apps don't manage server state by hand. Every resource you
[define](./resources) is reachable through a typed REST client, and
[TanStack Query](https://tanstack.com/query) (React Query) handles the
caching, loading flags, refetching, and invalidation. You write small hooks
that wrap the client.

This page covers four tools:

- [The aepbase client](#the-aepbase-client) — read and write resources.
- [Query keys](#query-keys) — name your cache slots consistently.
- [Data hooks](#data-hooks) — the read + mutate pattern.
- [Flags and settings](#flags-and-settings) — household- and per-user state.

---

## The aepbase client

`@rambleraptor/homestead-core/api/aepbase` is the REST wrapper for your
resources. Pass the collection's plural (import the constant from the
app's `resources.ts`).

```ts
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { GIFT_CARDS } from '../resources';

await aepbase.list<GiftCard>(GIFT_CARDS);          // GET   collection (auto-paginates)
await aepbase.get<GiftCard>(GIFT_CARDS, id);       // GET   one
await aepbase.create<GiftCard>(GIFT_CARDS, body);  // POST  (FormData for file fields)
await aepbase.update<GiftCard>(GIFT_CARDS, id, body); // PATCH (merge — send only changed fields)
await aepbase.remove(GIFT_CARDS, id);              // DELETE
```

For a [child resource](./resources#parent-child-resources), pass the
parent path:

```ts
await aepbase.list<Transaction>('transactions', {
  parent: ['gift-cards', cardId],   // → /gift-cards/{cardId}/transactions
});
```

`getCurrentUser()` gives you the signed-in user, handy for stamping a
`created_by` field as `users/{id}`.

---

## Query keys

`queryKeys` (from `@rambleraptor/homestead-core/api/queryClient`) builds
stable, hierarchical cache keys so reads and invalidations line up:

```ts
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';

queryKeys.app('gift-cards').all();                       // everything for the app
queryKeys.app('gift-cards').resource('gift-card').list();  // a collection
queryKeys.app('gift-cards').resource('gift-card').detail(id); // one record
```

Invalidate at the level you need. Invalidating `.all()` after a write
refreshes every list and detail view in the app.

---

## Data hooks

The convention is one small hook per operation, living in your app's
`hooks/` folder. A **read** is a `useQuery`:

```ts
// packages/homestead-apps/gift-cards/hooks/useGiftCards.ts
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { GIFT_CARDS } from '../resources';

export function useGiftCards() {
  return useQuery({
    queryKey: queryKeys.app('gift-cards').resource('gift-card').list(),
    queryFn: () => aepbase.list<GiftCard>(GIFT_CARDS),
  });
}
```

A **write** is a `useMutation` that invalidates the relevant keys
`onSuccess`, so any component reading that data updates itself:

```ts
// packages/homestead-apps/gift-cards/hooks/useCreateGiftCard.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { GIFT_CARDS } from '../resources';

export function useCreateGiftCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GiftCardFormData) =>
      aepbase.create<GiftCard>(GIFT_CARDS, data),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.app('gift-cards').all(),
      }),
  });
}
```

Components stay declarative: `const { data, isLoading } = useGiftCards()`
for reads, `const { mutateAsync, isPending } = useCreateGiftCard()` for
writes.

### Shortcut for plain CRUD

If a resource needs no custom logic, skip the boilerplate with the generic
resource hooks:

```ts
import { useResourceCreate } from '@rambleraptor/homestead-core/api/resourceHooks';

export const useCreateCreditCard = () =>
  useResourceCreate<CreditCard, CreditCardFormData>('credit-cards', 'credit-card');
```

They wire up the create/update/delete call and the cache invalidation for
you. Reach for a hand-written `useMutation` only when a write needs extra
steps (file handling, nested writes, name resolution).

---

## Flags and settings

Not every bit of state deserves its own resource. For small settings,
Homestead has two purpose-built stores, both read and written with a
single hook:

- **App flags** — one value shared across the whole household (feature
  toggles, defaults). Read with `useAppFlag`. See
  [App Flags](./app-flags).

  ```ts
  const { value, setValue } = useAppFlag<string>('groceries', 'default_store');
  ```

- **User settings** — one value *per user* (a personal preference). Declare
  a `userSettings` map on your app config, then read with `useUserSetting`
  from `@rambleraptor/homestead-core/user-settings`.

  ```ts
  const { value, setValue } =
    useUserSetting<'google' | 'apple'>('people', 'map_provider');
  ```

Both guarantee the declared default (never `undefined` once you set one)
and persist the change for you. Use a **resource** for lists of records,
an **app flag** for one household-wide value, and a **user setting** for a
per-person preference.
