# Bulk Import

Let users import rows from a CSV into your app.

You provide three things: a CSV schema, per-field validators, and a function
that saves one row. The bulk-import framework provides the rest — the file
upload UI, CSV parsing, a validation summary, a row preview, per-row error
reporting, and the import loop that refreshes your React Query data.

Validators run at parse time and can't make API calls. For checks that need
to fetch data, do them in the save step instead (see
[Resolving references by name](#resolving-references-by-name)).

Import everything from
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

The fastest start is to copy an existing app's setup. For a simple
one-row-to-one-record import, copy gift cards
(`packages/homestead-apps/gift-cards/bulk-import/`). For an import that
writes a parent record plus children, copy Pictionary
(`packages/homestead-apps/games/pictionary/bulk-import/`).

### 1. Create the bulk-import folder {#1-create-the-bulk-import-folder}

```
packages/homestead-apps/<feature>/bulk-import/
├── schema.ts          # column definitions + transformParsed
├── validators.ts      # per-field validators
├── types.ts           # the imported row shape (`T`)
├── index.tsx          # entry component
├── <App>Preview.tsx (optional)
└── useBulkImport<App>.ts (only if save logic is non-trivial)
```

### 2. Define the schema {#2-define-the-schema}

```ts
// packages/homestead-apps/<feature>/bulk-import/schema.ts
import type { BulkImportSchema } from '@rambleraptor/homestead-core/shared/bulk-import';
import { validateTask, validatePoints } from './validators';

export interface ChoreData {
  task: string;
  points: number;
}

export const choreSchema: BulkImportSchema<ChoreData> = {
  requiredFields: [
    { name: 'task', required: true, validator: validateTask,
      description: 'Chore name (max 200 chars)' },
    { name: 'points', required: true, validator: validatePoints,
      description: 'Points earned for finishing it' },
  ],
  optionalFields: [],
  generateTemplate: () => 'task,points\nTake out the trash,5\n',
};
```

The framework auto-renders the field list (with descriptions) on the
upload screen and offers a "Download Template" button using
`generateTemplate()`.

### 3. Write per-field validators {#3-write-per-field-validators}

A `FieldValidator<U>` takes the raw cell string + the full row object and
returns `{ value: U }` on success or `{ value, error }` on failure. The
`row` argument is useful for cross-field checks (see
[Cross-field validation](#cross-field-validation)).

```ts
// packages/homestead-apps/<feature>/bulk-import/validators.ts
import type { FieldValidator } from '@rambleraptor/homestead-core/shared/bulk-import';

export const validateTask: FieldValidator<string> = (value) => {
  const task = value.trim();
  if (task.length > 200) {
    return { value: task, error: 'task must be 200 characters or less' };
  }
  return { value: task };
};
```

Validators run synchronously at parse time. For data that needs to be
fetched async (e.g. "does this person exist?"), defer to the save step
(see [Resolving references by name](#resolving-references-by-name)).

### 4. Build the save hook {#4-build-the-save-hook}

For a one-row-to-one-record app, call `useBulkImport` with a `collection`.
The collection is the kebab-case plural URL segment — import it from the
app's `resources.ts` rather than hard-coding a string:

```ts
// in your bulk-import/index.tsx
import { CHORES } from '../resources';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';

const bulkImport = useBulkImport({
  collection: CHORES,
  queryKey: queryKeys.app('chores').list(),
});
```

For anything more complex (nested writes, name resolution, multi-step),
write a wrapper hook that uses the `saveItem` path — see
[Nested apps](#nested-apps-one-row--parent--children).

### 5. Custom preview component (optional) {#5-custom-preview-component-optional}

If you omit `PreviewComponent`, the preview falls back to
`DefaultItemPreview`, which renders each field as a key/value row. To show
a richer preview, set `PreviewComponent` on the schema. See
`GiftCardPreview.tsx`, `PersonPreview.tsx`, or `GamePreview.tsx` for
examples:

```ts
import { ChorePreview } from './ChorePreview';
export const choreSchema: BulkImportSchema<ChoreData> = {
  // ...
  PreviewComponent: ChorePreview,
};
```

### 6. Wire the entry component {#6-wire-the-entry-component}

```tsx
// packages/homestead-apps/<feature>/bulk-import/index.tsx
import { BulkImportContainer, useBulkImport } from '@rambleraptor/homestead-core/shared/bulk-import';
import { CHORES } from '../resources';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { choreSchema } from './schema';

export function ChoresBulkImport() {
  const bulkImport = useBulkImport({
    collection: CHORES,
    queryKey: queryKeys.app('chores').list(),
  });

  return (
    <BulkImportContainer
      config={{
        appName: 'Chores',
        appNamePlural: 'chores',
        backRoute: '/chores',
        schema: choreSchema,
        onImport: bulkImport.mutateAsync,
        isImporting: bulkImport.isPending,
      }}
    />
  );
}
```

### 7. Register the route {#7-register-the-route}

Add an `import` entry to the app's `routes` array in `app.config.ts`.
Point its `component` at a lazy import of the entry component:

```ts
// packages/homestead-apps/<feature>/app.config.ts
export const choresApp: AppConfig = {
  // ...
  basePath: '/chores',
  routes: [
    {
      path: '',
      index: true,
      component: () =>
        import('./components/ChoresHome').then((m) => m.ChoresHome),
    },
    {
      path: 'import',
      component: () =>
        import('./bulk-import').then((m) => m.ChoresBulkImport),
    },
  ],
  // ...
};
```

This makes the importer available at `/chores/import`. No other wiring is
needed.

### 8. Add a discoverable link {#8-add-a-discoverable-link}

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

### Simple apps: one row → one resource {#simple-apps-one-row--one-resource}

Gift cards is the canonical example. It uses the `collection` option with
no custom hook, pulling the collection constant from the app's
`resources.ts`:

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

### Nested apps: one row → parent + children {#nested-apps-one-row--parent--children}

When a row creates a parent record plus child records (e.g. one
Pictionary game with N teams), use the `saveItem` option. You provide the
per-row write; the framework still runs the loop, tracks errors, and
refreshes your data. Pull collection constants from the app's
`resources.ts`:

```ts
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { PICTIONARY_GAMES, PICTIONARY_TEAMS } from '../resources';

useBulkImport<PictionaryImportData, void>({
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

`transformParsed` runs only on rows that passed every per-field
validator, so you can trust the input.

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

Validators run at parse time and can't hit the API. For "does this
person/store/etc. exist?" checks, defer to save time: use the `prepare`
option to load a lookup table once before the loop starts. Its result is
passed to every `saveItem` call as `ctx`:

```ts
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { CHORES } from '../resources';
import { PEOPLE } from '../../people/resources';

interface PersonRecord { id: string; name: string }

useBulkImport<ChoreImportData, Map<string, string>>({
  queryKey: queryKeys.app('chores').list(),
  prepare: async () => {
    const people = await aepbase.list<PersonRecord>(PEOPLE);
    return new Map(people.map((p) => [p.name.toLowerCase(), p.id]));
  },
  saveItem: async (row, { ctx: peopleByName, createdBy }) => {
    const assigneeId = peopleByName.get(row.assignee.toLowerCase());
    if (!assigneeId) {
      throw new Error(`Unknown assignee: "${row.assignee}"`);
    }
    await aepbase.create(CHORES, {
      assignee: `people/${assigneeId}`,
      ...row, created_by: createdBy,
    });
  },
});
```

A thrown error becomes a per-row import error, so the user sees exactly
which rows had unknown references. Pictionary's
`useBulkImportPictionary.ts` is the live example: its `prepare`
(`loadPeopleMap`) loads a lowercased name → id map, and `saveItem`
resolves each team's players into `people/{id}` paths, throwing if any
name is unknown.

> When the single-pass loop isn't enough, write your own
> `useMutation` instead of `useBulkImport`. People's importer
> (`packages/homestead-apps/people/hooks/useBulkImportPeople.ts`) does
> this: it needs two passes — create everyone first, then resolve
> partner-by-name references — and its `index.tsx` imports that custom
> hook.
