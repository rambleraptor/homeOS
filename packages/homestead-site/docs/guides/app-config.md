# App Config

Every Homestead app is a single object that follows the `AppConfig` shape.
It's the manifest the registry reads to wire your app into navigation, the
router, the dashboard, the settings UI, and the schema sync — all from
declared data, with no per-app registry edits. This page is the field-by-field
reference for that object.

The type lives in
[`@rambleraptor/homestead-core/apps/types`](https://github.com/rambleraptor/homestead/blob/main/packages/homestead-core/apps/types.ts).
Import it where you declare your config:

```ts
import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';
```

For a hands-on walkthrough that builds an app from scratch, start with the
[Quick Start](./quick-start). This page assumes you already know what an app
is and want to know what each field does.

## Table of Contents

- [Where the config lives](#where-the-config-lives)
- [A minimal config](#a-minimal-config)
- [Identity & presentation](#identity-presentation)
- [Navigation](#navigation)
- [Routes](#routes)
- [Visibility & enablement](#visibility-enablement)
- [Data & behavior](#data-behavior)
- [Settings & flags](#settings-flags)
- [Dashboard widgets](#dashboard-widgets)
- [Nested apps](#nested-apps)
- [Field reference](#field-reference)

---

## Where the config lives

An app's config can be declared in two places, merged at boot:

- **Auto-discovered apps** in your project's `apps/` directory. Each
  `apps/<dir>/app.homestead.ts` **default-exports** an `AppConfig`. This is the
  path the [Quick Start](./quick-start) uses — no config wiring needed.
- **Explicit apps** listed in the `apps` array of `homestead.config.ts` at the
  repo root. Built-in feature apps export a **named** config (e.g.
  `export const groceriesApp: AppConfig`) from their `app.config.ts`.

On an id collision, the explicit `homestead.config.ts` entry wins. Either way
the object is the same `AppConfig` shape described below.

---

## A minimal config

Only a handful of fields are required. The smallest useful app declares its
identity, a base path, and one route:

```ts
import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';

const groceryApp: AppConfig = {
  id: 'grocery',
  name: 'Grocery',
  description: 'A shared grocery list.',
  icon: () => import('lucide-react').then((m) => m.ShoppingCart),
  basePath: '/grocery',
  routes: [
    {
      path: '',
      index: true,
      component: () => import('./GroceryHome').then((m) => m.GroceryHome),
    },
  ],
};

export default groceryApp;
```

Everything else is optional and additive: add `resources` to get a REST-backed
collection, `widgets` to surface a dashboard card, `flags` for household
settings, and so on.

---

## Identity & presentation

These fields name your app and give it a face in the UI.

```ts
{
  id: 'groceries',                 // unique, lowercase, no spaces
  name: 'Groceries',               // shown in nav and headings
  description: 'Manage your grocery list with smart categorization',
  icon: () => import('lucide-react').then((m) => m.ShoppingCart),
  homeScreenIcon: '/app-icons/groceries.png', // optional PWA icon
}
```

- **`id`** — the app's unique identifier (lowercase, no spaces). It keys the
  registry, the auto-injected `enabled` flag, and the `${appId}__${key}` flag
  field names. Pick it once; changing it later orphans stored flag values.
- **`name`** — the display name shown in navigation and page chrome.
- **`description`** — a short summary of what the app does.
- **`icon`** — a **lazy** Lucide icon thunk
  (`() => import('lucide-react').then((m) => m.X)`). Declaring it lazily keeps
  the icon out of the main bundle and lets non-React consumers import the config
  without pulling in the component graph.
- **`homeScreenIcon`** *(optional)* — a path to a square raster image (PNG,
  ideally 512×512) used when a user adds this app to their device home screen
  (PWA install). When set, navigating anywhere within the app swaps the
  `apple-touch-icon` and web app manifest so an "Add to Home Screen" uses this
  image and the app's own name/start path. Omit it to fall back to the shared
  Homestead icon.

---

## Navigation

Where (and whether) the app appears in navigation:

```ts
{
  basePath: '/groceries',   // required; must start with /
  showInNav: true,          // default true
  placement: 'sidebar',     // 'sidebar' (default) or 'topbar'
  navOrder: 2,              // lower numbers first; default 100
  section: 'Food',          // optional grouping header
  topBarBadge: () => import('./GroceriesBadge').then((m) => m.GroceriesBadge),
}
```

- **`basePath`** — the route prefix for the app (must start with `/`). All of
  the app's `routes` are relative to it.
- **`showInNav`** *(default `true`)* — set `false` to hide the app from both
  the sidebar and topbar while keeping its routes reachable.
- **`placement`** *(default `'sidebar'`)* — `'sidebar'` puts the app's entry in
  the left nav; `'topbar'` renders an icon-only button in the header instead. A
  topbar app never appears in the sidebar.
- **`navOrder`** *(default `100`)* — sort order within its section; lower
  numbers render first. Leave gaps so future apps slot in without renumbering.
- **`section`** *(optional)* — a grouping header in the sidebar. Apps without a
  section render at the end.
- **`topBarBadge`** *(optional)* — a lazy component that renders a small badge
  inside the app's top-bar button (only meaningful with `placement: 'topbar'`).
  It fetches its own data and returns the badge or `null`; compose
  `layout/TopBarBadge` for the standard count pill. It's a component rather than
  a hook because core must not import app code and hooks can't be called
  conditionally.

---

## Routes

`routes` is the list of pages the app renders. Each `AppRoute` declares its
`path` (relative to `basePath`) and a **lazy** `component` thunk. The SPA's
single catch-all renderer resolves the matching route — there are no per-route
page files.

```ts
routes: [
  // index route at /groceries
  {
    path: '',
    index: true,
    component: () => import('./components/GroceriesHome').then((m) => m.GroceriesHome),
  },
  // dynamic route at /groceries/:id
  {
    path: ':id',
    dynamic: true,
    component: () => import('./components/GroceryDetail').then((m) => m.GroceryDetail),
    gates: ['enabled'],
  },
],
```

Per-route fields:

- **`path`** — path relative to `basePath`. Use `''` for the index route and
  `:name` segments for dynamic params (e.g. `:id`). Captured params arrive on
  the component's `params` prop.
- **`index`** *(optional)* — marks the index route.
- **`component`** — the lazy component rendered at this route. Both default and
  named exports work (`() => import('./Foo')` or
  `() => import('./Foo').then((m) => m.Foo)`).
- **`gates`** *(optional)* — wrapper components applied around the route:
  `'enabled'` gates on the app's visibility, `'superuser'` restricts to
  superusers.
- **`dynamic`** *(optional)* — set `true` when the path uses `:name` params so
  it isn't statically prerendered.

---

## Visibility & enablement

Every app automatically receives an `enabled` flag (and a companion
`enabled_tags`) — you don't declare them. These fields seed and toggle that:

```ts
{
  enabled: true,             // default true
  defaultEnabled: 'all',     // 'all' | 'superusers' | 'none' | 'tagged'
}
```

- **`enabled`** *(default `true`)* — a static on/off switch for the app.
- **`defaultEnabled`** *(default `'all'`)* — the starting audience for the
  auto-injected `enabled` flag until an admin overrides it in the Flag
  Management UI. The options are `'all'` (all authenticated users),
  `'superusers'` (good for unfinished work), `'none'` (hidden from everyone),
  and `'tagged'` (visible to users whose tags intersect the app's
  `enabled_tags`).

See [App Flags → Gating Your App on Visibility](./app-flags#gating-your-app-on-visibility)
for the full visibility model and the `useIsAppEnabled` hook.

---

## Data & behavior

How the app stores data and how the offline mutation layer treats it:

```ts
{
  resources: groceriesResources,   // aepbase collections this app owns
  offlineOverrides: {
    store: {
      cascadeDelete: () => import('./offline').then((m) => m.storeCascadeDelete),
    },
  },
  filters: [/* AppFilterDecl[] */],
  metadata: { /* arbitrary app-specific data */ },
}
```

- **`resources`** *(optional)* — the aepbase
  [resource definitions](./resources) this app owns. The schema sync aggregates
  them across all apps and applies them on boot. Each `singular` must be
  globally unique.
- **`offlineOverrides`** *(optional)* — per-resource tweaks to the auto-derived
  create/update/delete mutation defaults, keyed by resource `singular`. Set a
  key to `false` to skip auto-registration entirely (for bespoke mutation
  logic), or pass an object to merge in overrides like `parentPath` (nested
  resources) or `cascadeDelete` (cross-resource effects on delete). Most apps
  need none — the factory derives the list cache key, mutation keys, optimistic
  shape, and request body from convention.
- **`filters`** *(optional)* — filterable fields for the app's list view. A
  shared `<FilterBar>` renders one input per decl and filters the list
  in-memory client-side (no server round-trip).
- **`metadata`** *(optional)* — an arbitrary bag of app-specific data
  (`Record<string, unknown>`).

> Server-side endpoints aren't declared on the app. They're AEP-136 custom
> methods on a resource definition (`ResourceDefinition.customMethods`),
> addressed as `POST /<plural>:<verb>`. See `core/resources/types.ts`.

---

## Settings & flags

Apps can declare two kinds of typed settings. Both are flattened into a shared
resource with `${appId_snake}__${key}` field names.

```ts
{
  // Household-wide settings (one value for everyone).
  flags: {
    default_store: {
      type: 'string',
      label: 'Default store',
      description: 'Store id pre-selected when adding new grocery items.',
      default: '',
    },
  },
  // Per-user settings (scoped to the signed-in user).
  userSettings: {
    sort_order: {
      type: 'enum',
      label: 'Sort order',
      description: 'How your list is ordered.',
      options: ['alpha', 'recent'],
      default: 'alpha',
    },
  },
  // Replace the auto-generated settings form with bespoke UI.
  settingsWidget: () => import('./GrocerySettings').then((m) => m.GrocerySettings),
}
```

- **`flags`** *(optional)* — household-wide typed knobs. Read and write them
  with `useAppFlag(appId, key)`. The flag declaration shape (`AppFlagDef`)
  supports `string`, `number`, `boolean`, and `enum` types. See the dedicated
  [App Flags](./app-flags) guide.
- **`userSettings`** *(optional)* — same declaration shape as `flags`, but the
  value is scoped per-user (backed by the `user-preference` resource). The
  settings page auto-generates a form for these unless `settingsWidget` is set.
- **`settingsWidget`** *(optional)* — a lazy component shown on the Settings
  page in place of the auto-generated form, for when per-user settings need
  bespoke UI. It takes no props and reads/writes via `useUserSetting`.

`AppFlagDef` (and the identical `UserSettingDef`):

```ts
type AppFlagDef =
  | { type: 'string';  label: string; description: string; default?: string }
  | { type: 'number';  label: string; description: string; default?: number }
  | { type: 'boolean'; label: string; description: string; default?: boolean }
  | { type: 'enum';    label: string; description: string;
      options: readonly string[]; default?: string };
```

---

## Dashboard widgets

`widgets` lets an app contribute summary cards to the home dashboard. Each is a
self-contained, zero-prop React component declared with a lazy `component`
thunk:

```ts
widgets: [
  {
    id: 'groceries-remaining',          // globally unique; prefix with app id
    label: 'Groceries',                 // shown in the customization UI
    component: () =>
      import('./components/GroceriesWidget').then((m) => m.GroceriesWidget),
    order: 10,                          // lower renders first; default 100
  },
],
```

The dashboard discovers widgets from every installed app's config and lays them
out by `order`. See the [Dashboard Widgets](./widgets) guide for the component
contract, `<WidgetCard>` chrome, and conventions.

---

## Nested apps

Setting `children` turns an app into a container. The registry validates each
child's `basePath` is a prefix of the parent's, aggregates child routes and
widgets, and renders a `<NestedAppLanding>` of cards on the parent's index
page:

```ts
{
  id: 'finance',
  basePath: '/finance',
  // ...
  children: [creditCardsApp, hsaApp],
}
```

Each child is a full `AppConfig` and gets its own `enabled` flag (and any other
declared flags), so nested pages can be gated independently and reached via
`getApp(id)`. Children stay out of top-level navigation — the parent owns the
sidebar placement.

---

## Field reference

| Field              | Type                              | Required | Default      | Purpose                                                        |
| ------------------ | --------------------------------- | -------- | ------------ | -------------------------------------------------------------- |
| `id`               | `string`                          | ✅       | —            | Unique identifier (lowercase, no spaces).                      |
| `name`             | `string`                          | ✅       | —            | Display name in nav and UI.                                    |
| `description`      | `string`                          | ✅       | —            | Short summary of the app.                                      |
| `icon`             | `LazyIcon`                        | ✅       | —            | Lazy Lucide icon thunk.                                        |
| `basePath`         | `string`                          | ✅       | —            | Route prefix; must start with `/`.                             |
| `routes`           | `AppRoute[]`                      | ✅       | —            | The app's pages.                                               |
| `homeScreenIcon`   | `string`                          | —        | shared icon  | PWA "Add to Home Screen" image path.                           |
| `showInNav`        | `boolean`                         | —        | `true`       | Show the app in navigation.                                    |
| `placement`        | `'sidebar' \| 'topbar'`           | —        | `'sidebar'`  | Where the nav entry renders.                                   |
| `topBarBadge`      | `LazyComponent`                   | —        | —            | Badge for a topbar app's button.                               |
| `navOrder`         | `number`                          | —        | `100`        | Sort order in nav (lower first).                               |
| `section`          | `string`                          | —        | —            | Grouping header in the sidebar.                                |
| `enabled`          | `boolean`                         | —        | `true`       | Static on/off switch.                                          |
| `defaultEnabled`   | `AppVisibility`                   | —        | `'all'`      | Starting audience for the auto `enabled` flag.                 |
| `metadata`         | `Record<string, unknown>`         | —        | —            | Arbitrary app-specific data.                                   |
| `filters`          | `AppFilterDecl[]`                 | —        | —            | Client-side list filters.                                      |
| `flags`            | `Record<string, AppFlagDef>`      | —        | —            | Household-wide typed settings.                                 |
| `userSettings`     | `Record<string, UserSettingDef>`  | —        | —            | Per-user typed settings.                                       |
| `settingsWidget`   | `LazyComponent`                   | —        | —            | Custom settings-page UI.                                       |
| `resources`        | `ResourceDefinition[]`            | —        | —            | aepbase collections the app owns.                              |
| `offlineOverrides` | `Record<string, ResourceOverride \| false>` | — | —      | Per-resource mutation-default overrides.                       |
| `widgets`          | `DashboardWidget[]`               | —        | —            | Dashboard summary cards.                                       |
| `children`         | `AppConfig[]`                     | —        | —            | Sub-apps; makes this a container app.                          |

---

## Related

- [Quick Start](./quick-start) — build an app end-to-end.
- [Defining Resources](./resources) — the `resources` field in depth.
- [Dashboard Widgets](./widgets) — the `widgets` field in depth.
- [App Flags](./app-flags) — the `flags`/`userSettings` fields and visibility.
