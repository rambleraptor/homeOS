# Data Migrations

Change the *shape* of a collection and Homestead's schema sync handles it for
you on the next boot — it creates new fields, patches drifted definitions, and
no-ops when everything already matches. What it deliberately never touches is
the *data* already sitting in those rows.

A **data migration** fills that gap. Use one to:

- backfill a newly-added field on existing records,
- rewrite a value (rename an enum option, reformat a string, split one field
  into two),
- or correct rows a bug wrote badly.

A migration is a one-shot server-side function that runs **once**, is recorded
in a ledger, and is never run again after it succeeds.

## Writing one

A migration is a plain async function. It receives a short-lived admin `token`
and a `log()`, and it reads and rewrites data through the same server-side
aepbase helpers the rest of the server uses — so references, file fields,
validation, and `update_time` all keep working.

Keep the handler under your app's `migrations/` directory so the production
build stubs it out of the browser bundle:

```ts
// packages/homestead-apps/gift-cards/migrations/backfill-status.ts
import type { MigrationHandler } from '@rambleraptor/homestead-core/apps/migrations';
import { aepList, aepUpdate } from '@rambleraptor/homestead-core/server/aepbase';

interface GiftCard {
  id: string;
  status?: string;
  balance?: number;
}

const migrate: MigrationHandler = async ({ token, log }) => {
  const cards = await aepList<GiftCard>('gift-cards', token);
  let patched = 0;
  for (const card of cards) {
    if (card.status) continue; // idempotent guard — skip rows already done
    const status = (card.balance ?? 0) > 0 ? 'active' : 'depleted';
    await aepUpdate('gift-cards', card.id, { status }, token);
    if (++patched % 50 === 0) await log(`patched ${patched}…`);
  }
  return { scanned: cards.length, patched }; // recorded in the ledger
};

export default migrate;
```

Declare it on your app config — the same shape as `crons`:

```ts
// packages/homestead-apps/gift-cards/app.config.ts
export const giftCardsApp: AppConfig = {
  id: 'gift-cards',
  // …
  migrations: [
    {
      id: 'gift-cards-backfill-status', // stable, globally unique — never rename
      title: 'Backfill gift-card status from balance',
      load: () => import('./migrations/backfill-status'),
    },
  ],
};
```

That's the whole authoring surface. Restart the server and the migration runs
after the schema sync; its result and any `log()` lines land in the ledger.

## How it runs

- **Once, at boot.** After the schema sync applies every resource definition
  (so the collections a migration targets already exist), the runner applies
  each pending migration in declaration order.
- **Remembered.** Each attempt is written to a `_homestead_migrations` ledger
  table (id, app, status, result/error, logs). A migration that has succeeded
  is skipped on every later boot.
- **Retried on failure.** A migration that threw — or whose process died before
  the ledger recorded success — is *pending* again next boot. A thrown error is
  recorded and does **not** stop the other migrations; they touch independent
  data.

## Rules

1. **The `id` is the ledger key — never rename or reuse it.** Change an id and
   an already-applied migration runs again; reuse one and a new migration is
   silently skipped. Prefer an app-prefixed slug like
   `gift-cards-backfill-status`.
2. **Write handlers to be idempotent.** The ledger stops a *succeeded*
   migration from re-running, but a *resumed* one (crash mid-run) re-executes
   from the top — so guard each record (skip rows already in the target shape)
   rather than assuming a clean slate.
3. **Go through the engine, not raw SQL.** Use the
   `@rambleraptor/homestead-core/server/aepbase` helpers so references, file
   fields, and validation stay intact.
4. **Return a small summary** (`{ scanned, patched }`) — it's stored as the
   migration's `result` and makes the ledger useful.
5. **Mark destructive migrations** with `destructive: true`. It's recorded for
   visibility today; a future `homestead migrate` command will use it to gate
   destructive runs behind an explicit opt-in.

## When *not* to use one

Adding a field, an enum value, or a whole resource is a **schema** change, not a
migration — declare it in your app's `resources.ts` and the schema sync applies
it. Reach for a migration only when existing **data** needs to change to match.
