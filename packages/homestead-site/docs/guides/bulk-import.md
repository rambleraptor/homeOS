# Bulk Import

Let users import rows from a CSV into your app. This guide shows how to
add a working CSV importer to a Homestead feature app.

You declare **what** to import — a CSV schema, per-field validators, and a
"save one row" function. The framework supplies the **how** — the file
upload UI, CSV parsing, a validation summary, a row preview, per-row error
reporting, and the import loop with React Query invalidation. Validators run
synchronously at parse time (so they can't hit the API); the framework then
loops your valid rows and calls your save logic for each. Import everything
from the workspace alias
`@rambleraptor/homestead-core/shared/bulk-import`.

## Table of Contents

- [Adding bulk import to your app](#adding-bulk-import-to-your-app)
  - [1. Create the bulk-import folder](#1-create-the-bulk-import-folder)
  - [2. Define the schema](#2-define-the-schema)
  - [3. Write per-field validators](#3-write-per-field-validators)
  - [4. Build the save hook](#4-build-the-save-hook)
  - [5. Custom preview component (optional)](#5-custom-preview-component-optional)
  - [6. Wire the entry component](#6-wire-the-entry-component)
  - [7. Register the route](#7-register-the-route)
  - [8. Add a discoverable link](#8-add-a-discoverable-link)
- [Patterns](#patterns)
  - [Simple apps: one row → one resource](#simple-apps-one-row--one-resource)
  - [Nested apps: one row → parent + children](#nested-apps-one-row--parent--children)
  - [Reshaping multi-column input](#reshaping-multi-column-input)
  - [Cross-field validation](#cross-field-validation)
  - [Resolving references by name](#resolving-references-by-name)

---

## Adding bulk import to your app

The shortest path is to copy the gift-cards app's setup
(`packages/homestead-apps/gift-cards/bulk-import/`); for nested writes,
copy Pictionary's
(`packages/homestead-apps/games/pictionary/bulk-import/`).

### 1. Create the bulk-import folder

```
packages/homestead-apps/<feature>/bulk-import/
├── schema.ts          # column definitions + transformParsed
├── validators.ts      # per-field validators
├── types.ts           # the imported row shape (`T`)
├── index.tsx          # entry component
├── <App>Preview.tsx (optional)
└── useBulkImport<App>.ts (only if save logic is non-trivial)
```

### 2. Define the schema

```ts
// packages/homestead-apps/<feature>/bulk-import/schema.ts
import type { BulkImportSchema } from '@rambleraptor/homestead-core/shared/bulk-import';
import { validateName, validateAmount } from './validators';

export interface MyImportData {
  name: string;
  amount: number;
}

export const myImportSchema: BulkImportSchema<MyImportData> = {
  requiredFields: [
    { name: 'name', required: true, validator: validateName,
      description: 'Display name (max 200 chars)' },
    { name: 'amount', required: true, validator: validateAmount,
      description: 'Numeric amount' },
  ],
  optionalFields: [],
  generateTemplate: () => 'name,amount\nExample,42.00\n',
};
```

The framework auto-renders the field list (with descriptions) on the
upload screen and offers a "Download Template" button using
`generateTemplate()`.

### 3. Write per-field validators

A `FieldValidator<U>` takes the raw cell string + the full row object and
returns `{ value: U }` on success or `{ value, error }` on failure. The
`row` argument is useful for cross-field checks (see
[Cross-field validation](#cross-field-validation)).

```ts
// packages/homestead-apps/<feature>/bulk-import/validators.ts
import type { FieldValidator } from '@rambleraptor/homestead-core/shared/bulk-import';

export const validateName: FieldValidator<string> = (value) => {
  const name = value.trim();
  if (name.length > 200) {
    return { value: name, error: 'name must be 200 characters or less' };
  }
  return { value: name };
};
```

Validators run synchronously at parse time. For data that needs to be
fetched async (e.g. "does this person exist?"), defer to the save step
(see [Resolving references by name](#resolving-references-by-name)).

### 4. Build the save hook

For a simple one-row → one-resource app, just call `useBulkImport`
directly with a `collection`. The collection is the kebab-case plural URL
segment — import it from the app's `resources.ts` rather than hard-coding
a string:

```ts
// in your bulk-import/index.tsx
import { MY_THINGS } from '../resources';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';

const bulkImport = useBulkImport({
  collection: MY_THINGS,
  queryKey: queryKeys.app('my-thing').list(),
});
```

For anything more complex (nested writes, name resolution, multi-step),
write a wrapper hook that uses the `saveItem` path — see
[Nested apps](#nested-apps-one-row--parent--children).

### 5. Custom preview component (optional)

Skipping `PreviewComponent` falls back to `DefaultItemPreview`, which
just renders each field as a key/value row. Most apps want something
prettier — see `GiftCardPreview.tsx`, `PersonPreview.tsx`, or
`GamePreview.tsx` for examples. Set it on the schema:

```ts
import { MyPreview } from './MyPreview';
export const myImportSchema: BulkImportSchema<MyImportData> = {
  // ...
  PreviewComponent: MyPreview,
};
```

### 6. Wire the entry component

```tsx
// packages/homestead-apps/<feature>/bulk-import/index.tsx
import { BulkImportContainer, useBulkImport } from '@rambleraptor/homestead-core/shared/bulk-import';
import { MY_THINGS } from '../resources';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { myImportSchema } from './schema';

export function MyAppBulkImport() {
  const bulkImport = useBulkImport({
    collection: MY_THINGS,
    queryKey: queryKeys.app('my-thing').list(),
  });

  return (
    <BulkImportContainer
      config={{
        appName: 'My Things',
        appNamePlural: 'my things',
        backRoute: '/my-thing',
        schema: myImportSchema,
        onImport: bulkImport.mutateAsync,
        isImporting: bulkImport.isPending,
      }}
    />
  );
}
```

### 7. Register the route

The SPA has no per-route page files — routes are declared inline on each
app. Add an `import` entry to the app's `routes` array in
`app.config.ts`, pointing `component` at a lazy import of the entry
component:

```ts
// packages/homestead-apps/<feature>/app.config.ts
export const myApp: AppConfig = {
  // ...
  basePath: '/my-thing',
  routes: [
    {
      path: '',
      index: true,
      component: () =>
        import('./components/MyHome').then((m) => m.MyHome),
    },
    {
      path: 'import',
      component: () =>
        import('./bulk-import').then((m) => m.MyAppBulkImport),
    },
  ],
  // ...
};
```

The SPA's catch-all renderer
(`packages/homestead-app/src/apps/AppRoute.tsx`) resolves the route's
lazy `component` for the matched path (here `/my-thing/import`), so there's
nothing else to wire up.

### 8. Add a discoverable link

In your app's home component, add an "Import" button alongside the
primary "New X" action that navigates to `/<feature>/import` via
react-router's `useNavigate`. See `PeopleHome.tsx` for the pattern:

```tsx
import { useNavigate } from 'react-router-dom';
// ...
const navigate = useNavigate();
// ...
<Button variant="secondary" onClick={() => navigate('/people/import')}>
  Import
</Button>
```

## Patterns

### Simple apps: one row → one resource

Gift cards is the canonical example. It uses the built-in `collection`
path with no custom hook, pulling the collection constant from the
app's `resources.ts`:

```ts
import { GIFT_CARDS } from '../resources';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';

useBulkImport({
  collection: GIFT_CARDS,
  queryKey: queryKeys.app('gift-cards').resource('gift-card').list(),
  transformData: (data) => ({
    ...(data as Record<string, unknown>),
    front_image: null,
    back_image: null,
  }),
});
```

`transformData` runs once per row right before the create call, useful
for adding fields the CSV doesn't carry (here the file fields the CSV
import can't supply). The framework adds `created_by` automatically.

### Nested apps: one row → parent + children

When a row creates a parent record plus child records (e.g. one
Pictionary game with N teams), use the `saveItem` path. The framework
still owns the loop, error tracking, and query invalidation; you just
provide the per-row write. Collection constants come from the app's
`resources.ts`:

```ts
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { PICTIONARY_GAMES, PICTIONARY_TEAMS } from '../resources';

useBulkImport<MyImportData, void>({
  queryKey: queryKeys.app('pictionary').all(),
  saveItem: async (row, { createdBy }) => {
    const game = await aepbase.create(PICTIONARY_GAMES, {
      ...row, created_by: createdBy,
    });
    await Promise.all(
      row.teams.map((team) =>
        aepbase.create(
          PICTIONARY_TEAMS,
          { ...team, created_by: createdBy },
          { parent: [PICTIONARY_GAMES, game.id] },
        ),
      ),
    );
  },
});
```

A thrown error is caught by the framework, recorded against the row's
line number, and the next row continues.

### Reshaping multi-column input

When several CSV columns logically collapse into one nested field
(e.g. `team_1` ... `team_6` → `teams: Team[]`), declare each column
as its own field with its own validator, then use `transformParsed` to
build the final shape:

```ts
export const myImportSchema: BulkImportSchema<CleanShape> = {
  requiredFields: [/* team_1, team_2 with makeTeamValidator */],
  optionalFields: [/* team_3..team_6, winner */],
  transformParsed: (raw) => {
    const teams: Team[] = [];
    TEAM_COLUMNS.forEach((col, index) => {
      const cell = raw[col] as { playerNames: string[] } | null | undefined;
      if (!cell) return;
      teams.push({ position: index + 1, playerNames: cell.playerNames });
    });
    return { teams, winner: raw.winner as number | undefined };
  },
  generateTemplate,
};
```

`transformParsed` only runs on rows that passed every per-field
validator, so you can trust the input. (Pictionary wraps its schema in a
`makePictionaryImportSchema(peopleByName)` factory so the team validators
can be wired with an async-loaded people lookup — see
[Resolving references by name](#resolving-references-by-name).)

### Cross-field validation

A field validator's second argument is the full raw row, so a validator
for one column can read the unparsed text of another column. Pictionary
uses this to verify the `winner` cell (a 1-based team position) points at
a team_N column that actually has players:

```ts
export const validateWinner: FieldValidator<number | undefined> = (value, row) => {
  const raw = value.trim();
  if (!raw) return { value: undefined };

  const position = Number(raw);
  if (!Number.isInteger(position) || position < 1 || position > TEAM_COLUMNS.length) {
    return {
      value: undefined,
      error: `winner must be a team position between 1 and ${TEAM_COLUMNS.length}`,
    };
  }

  const cellRaw = row[TEAM_COLUMNS[position - 1]]?.trim();
  if (!cellRaw) {
    return { value: undefined, error: `winner position ${position} has no team in this row` };
  }
  return { value: position };
};
```

### Resolving references by name

Validators run synchronously at parse time, so they can't hit the API.
For "does this person/store/etc. exist?" checks, defer to save time and
use the `prepare` hook to load the lookup table once before the loop
starts. The result is passed to every `saveItem` call as `ctx`:

```ts
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { MY_THINGS } from '../resources';
import { PEOPLE } from '../../people/resources';

interface PersonRecord { id: string; name: string }

useBulkImport<MyImportData, Map<string, string>>({
  queryKey: queryKeys.app('my-thing').list(),
  prepare: async () => {
    const people = await aepbase.list<PersonRecord>(PEOPLE);
    return new Map(people.map((p) => [p.name.toLowerCase(), p.id]));
  },
  saveItem: async (row, { ctx: peopleByName, createdBy }) => {
    const ownerId = peopleByName.get(row.owner.toLowerCase());
    if (!ownerId) {
      throw new Error(`Unknown owner: "${row.owner}"`);
    }
    await aepbase.create(MY_THINGS, {
      owner: `people/${ownerId}`,
      ...row, created_by: createdBy,
    });
  },
});
```

A thrown error becomes a per-row import error so the user sees exactly
which rows had unknown references. Pictionary's
`useBulkImportPictionary.ts` is the live example: its `prepare`
(`loadPeopleMap`) loads a lowercased name → id map, and `saveItem`
resolves each team's players into `people/{id}` paths, throwing if any
name is unknown. The same map also drives preview-time validation via the
`usePeopleNameMap` query (see `peopleMap.ts`), so unknown names surface in
the preview before the import even runs.

> Not every app fits the generic hook. People's importer
> (`packages/homestead-apps/people/hooks/useBulkImportPeople.ts`) is a
> hand-written `useMutation` because it needs two passes — create everyone
> first, then resolve partner-by-name references — and its `index.tsx`
> simply imports that hook instead of `useBulkImport`. Reach for a custom
> hook when the framework's single-pass loop isn't enough.
