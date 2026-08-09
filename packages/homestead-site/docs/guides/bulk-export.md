# Bulk Export

Let users export an app's records to a file — and let the CLI and any REST
client do the same. Bulk export is the mirror image of
[bulk import](./bulk-import): where import runs `parse → save`, export runs
`source → serialize`.

Export is a property of a **resource**, not a page. You declare which file
formats the resource can be exported to; the framework gives you the API, the
Export button, and the download.

```ts
// packages/homestead-apps/people/resources.ts
bulkExport: {
  formats: [
    {
      id: 'csv',
      label: 'CSV',
      mimeType: 'text/csv',
      extension: 'csv',
      load: () => import('./methods/bulk-export-csv'),
    },
  ],
}
```

That declaration alone gets you `GET /api/aep/people:bulk-export`, an entry in
`GET /api/custom-methods`, `homestead resources people bulk-export`, and a
working Export button.

## Table of Contents

- [How it works](#how-it-works)
- [Adding bulk export to your app](#adding-bulk-export-to-your-app)
  - [1. Write the serializer](#1-write-the-serializer)
  - [2. Declare the format](#2-declare-the-format)
  - [3. Add the button](#3-add-the-button)
- [Custom sources](#custom-sources)
- [Selecting which records](#selecting-which-records)
- [The API](#the-api)
- [Round-trip with import](#round-trip-with-import)
- [Where code goes](#where-code-goes)

---

## How it works

Fetching and serializing both run **server-side**, behind a custom method the
registry synthesizes from your `bulkExport` declaration. That's what makes export
scriptable — the Export button and a `curl` are the same call.

Unlike bulk import (a `POST` that spawns an [AEP-151](https://aep.dev/151/)
operation), export is a plain **`GET`** that streams the file straight back with
a `Content-Disposition: attachment` header. A download is a read: it needs no
request body and no progress polling.

The pipeline has two seams you can override, mirroring import's parser and saver:

- a **source** fetches the records and shapes them into flat rows (the mirror of
  import's saver);
- a **serializer** turns rows into a file's bytes (the mirror of import's
  parser).

## Adding bulk export to your app

### 1. Write the serializer {#1-write-the-serializer}

For a CSV, declare your columns and let `createCsvSerializer` do the rest:

```ts
// packages/homestead-apps/<feature>/methods/bulk-export-csv.ts
import { createCsvSerializer } from '@rambleraptor/homestead-core/server/bulk-export/csv';

export default createCsvSerializer(['name', 'address', 'notes']);
```

A column may be a bare name (read straight off each row) or an object with a
custom accessor and a description:

```ts
export default createCsvSerializer<Person>([
  { name: 'name', description: 'Full name' },
  { name: 'city', value: (p) => p.address?.city },
]);
```

`createCsvSerializer` handles RFC 4180 quoting (values with commas, quotes, or
newlines are quoted and embedded quotes doubled), so a file it emits re-parses
cleanly.

::: warning Serializers must live under your app's `methods/` directory.
`resources.ts` is reachable from the client registry, so the production build
stubs out `methods/*` imports to keep server-only code out of the browser bundle.
A serializer outside `methods/` ships to every visitor.
:::

A serializer doesn't have to be a CSV — implement `BulkExportSerializer` directly
to emit JSON, an archive, or anything else:

```ts
const serializer: BulkExportSerializer<MyRow> = {
  serialize(rows, ctx) {
    return JSON.stringify(rows, null, 2); // string or Uint8Array
  },
};
export default serializer;
```

### 2. Declare the format {#2-declare-the-format}

Add `bulkExport` to the resource in `resources.ts` (see the top of this page).
It's server-only — it never reaches aepbase (the schema-sync wire payload is an
explicit whitelist), same as `bulkImport` and `customMethods`.

### 3. Add the button {#3-add-the-button}

The button is the same for every app:

```tsx
import { BulkExportButton } from '@rambleraptor/homestead-core/shared/bulk-export';
import { PEOPLE } from '../resources';

<BulkExportButton plural={PEOPLE} />
```

It reads the resource's formats from the server at runtime, so it needs no
changes when you add a file type. With one format it downloads on click; with
several it opens a small menu. For a resource that declares no `bulkExport`, it
renders nothing. Pass a `filter` prop (an aepbase list-filter) to export only the
rows currently in view.

## Custom sources

By default the export lists the resource's own collection: one row per record,
its own columns. When a row means more than that, declare a source — the mirror
of import's saver.

```ts
bulkExport: {
  formats: [...],
  source: () => import('./methods/bulk-export-csv'), // the module exports `source`
}
```

```ts
export const source: BulkExportSource<PersonRow> = async ({ ctx, filter }) => {
  const hs = serverClient(ctx.auth.token);
  const people = await hs.collection('people').listAll(filter ? { filter } : undefined);
  // ...join across collections, shape each record into a flat row...
  return rows;
};
```

A source receives the whole request at once, so it can do the cross-collection
joins the default can't. **People** is the reason: a person's address lives in a
sibling `address` record linked through `person-shared-data`, and their partner
is another person — so exporting "names and addresses" means walking that graph
backwards. That's exactly the inverse of what the people *importer's* saver
writes.

## Selecting which records

Everything narrows through the one `filter` channel — including an explicit
"export exactly these" selection. The engine's `id` column is filterable and its
`in` operator takes a list literal, so a picked set of records is just a filter:

```
id in ["p1", "p2", "p3"]
```

That composes with any other predicate (both apply, AND), and defaults to
"everything," so a bare export is unchanged. There's no separate selection API —
a record that no longer exists simply isn't returned (the filter matches what's
there), the same as any other filter.

A custom source just forwards `filter` to its list; the engine does the
narrowing:

```ts
export const source = async ({ ctx, filter }) => {
  const people = await hs.collection('people').listAll(filter ? { filter } : undefined);
  // ...join and shape rows...
};
```

On the client, build the selection filter with `selectionFilter(ids)` and pass
it to `<BulkExportButton>`. The reusable `useRowSelection` hook backs a checkbox
list (per-row checkboxes plus a select-all that tracks the current filter):

```tsx
import { BulkExportButton, selectionFilter } from '@rambleraptor/homestead-core/shared/bulk-export';

const selection = useRowSelection(visibleRows.map((r) => r.id));
// ...checkbox per row wired to selection.isSelected / selection.set...
<BulkExportButton
  plural="people"
  filter={selectionFilter(selection.selectedIds)}   // id in ["…", "…"]
  disabled={selection.count === 0}
  label="Export selected"
/>
```

## The API

```http
GET /api/aep/people:bulk-export?format=csv

→ 200
Content-Type: text/csv
Content-Disposition: attachment; filename="people.csv"

name,address,wifi_network,wifi_password,partner_name
Jane Doe,"123 Main St",HomeWiFi,pw,John Doe
```

Query params (all optional):

- `format` — a format id declared on the resource. Defaults to the first.
- `filter` — an aepbase list-filter passed to the source. Defaults to everything.
  A record selection rides here as `id in ["a", "b", ...]`.
- `filename` — overrides the download filename. Defaults to `<plural>.<ext>`.

From the CLI or a script:

```bash
homestead resources people bulk-export > people.csv
```

## Round-trip with import

Because both sides can share a single column list, a CSV you export re-imports
cleanly. People does exactly this: its export serializer derives its columns from
the same `personCsvSchema` the importer validates against, so the import
*template* and the export *header* can never drift.

## Where code goes

```
packages/homestead-apps/<feature>/
├── resources.ts                    # the `bulkExport` declaration
├── methods/
│   └── bulk-export-csv.ts          # serializer (default) + optional `source` — SERVER ONLY
└── components/
    └── <App>Home.tsx               # renders <BulkExportButton plural={…} />
```

Framework internals, if you need them:

- `core/resources/bulk-export/types.ts` — the contract (formats, sources,
  serializers, wire shapes)
- `core/server/bulk-export/csv.ts` — `createCsvSerializer` and the CSV escaping
- `core/server/bulk-export/handler.ts` — the shared handler
- `core/shared/bulk-export/` — the button and its hooks
```
