# App Config

Every Homestead app is one object that follows the `AppConfig` shape — the
manifest the registry reads to wire your app into navigation, the router, the
dashboard, settings, and the schema sync, all from declared data. This page is
the field reference.

The type lives in
[`@rambleraptor/homestead-core/apps/types`](https://github.com/rambleraptor/homestead/blob/main/packages/homestead-core/apps/types.ts).
New to apps? Start with the [Quick Start](./quick-start); this page assumes you
already know what an app is.

## Where it lives

A config can be declared in two places, merged at boot (an explicit entry wins
on an id collision):

- **Auto-discovered** — `apps/<dir>/app.homestead.ts` **default**-exports the
  config. No wiring needed; this is what the [Quick Start](./quick-start) uses.
- **Explicit** — listed in the `apps` array of `homestead.config.ts`. The
  bundled example apps **named**-export their config from `app.config.ts`.

## Minimal config

Only `id`, `name`, `description`, `icon`, `basePath`, and `routes` are
required. Everything else is optional and additive.

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

Note the **lazy** thunks: `icon` and each route's `component` are
`() => import(...)`, which keeps them code-split and lets non-React consumers
import the config without pulling in the component graph.

## Fields

| Field              | Type                                        | Default     | Purpose                                                                 |
| ------------------ | ------------------------------------------- | ----------- | ----------------------------------------------------------------------- |
| `id` *             | `string`                                    | —           | Unique identifier (lowercase, no spaces). Keys the registry and flags.  |
| `name` *           | `string`                                    | —           | Display name in nav and UI.                                             |
| `description` *    | `string`                                    | —           | Short summary of the app.                                              |
| `icon` *           | `LazyIcon`                                  | —           | Lazy Lucide icon thunk.                                                |
| `basePath` *       | `string`                                    | —           | Route prefix; must start with `/`.                                    |
| `routes` *         | `AppRoute[]`                                | —           | The app's pages ([below](#routes)).                                   |
| `homeScreenIcon`   | `string`                                    | shared icon | PWA "Add to Home Screen" image path (square PNG, ~512×512).            |
| `showInNav`        | `boolean`                                   | `true`      | `false` hides the app from nav but keeps routes reachable.            |
| `placement`        | `'sidebar' \| 'topbar'`                     | `'sidebar'` | Where the nav entry renders. Topbar apps are icon-only.              |
| `topBarBadge`      | `LazyComponent`                             | —           | Badge inside a topbar app's button (fetches its own data).          |
| `navOrder`         | `number`                                    | `100`       | Sort order within a section (lower first).                          |
| `section`          | `string`                                    | —           | Grouping header in the sidebar. Unsectioned apps render last.       |
| `defaultEnabled`   | `AppVisibility`                             | `'all'`     | Starting audience for the auto `enabled` flag — see [App Flags](./app-flags#gating-your-app-on-visibility). |
| `metadata`         | `Record<string, unknown>`                   | —           | Arbitrary app-specific data.                                       |
| `filters`          | `AppFilterDecl[]`                           | —           | Client-side, in-memory list filters.                               |
| `resources`        | `ResourceDefinition[]`                      | —           | aepbase collections the app owns — see [Resources](./resources).   |
| `offlineOverrides` | `Record<string, ResourceOverride \| false>` | —           | Override auto-derived mutation defaults; `false` opts out entirely. |
| `flags`            | `Record<string, AppFlagDef>`                | —           | Household-wide typed settings ([below](#flags-user-settings)).      |
| `userSettings`     | `Record<string, UserSettingDef>`            | —           | Per-user typed settings (same shape as `flags`).                   |
| `settingsWidget`   | `LazyComponent`                             | —           | Custom settings-page UI in place of the auto-generated form.       |
| `widgets`          | `DashboardWidget[]`                         | —           | Dashboard summary cards ([below](#widgets)).                       |
| `children`         | `AppConfig[]`                               | —           | Sub-apps; makes this a container app ([below](#nested-apps)).      |

`*` = required.

> Server-side endpoints aren't declared here. They're AEP-136 custom methods on
> a resource definition (`ResourceDefinition.customMethods`), addressed as
> `POST /<plural>:<verb>`.

## Routes

Each route's `path` is relative to `basePath`; the SPA's single catch-all
renderer resolves it. Use `''` for the index and `:name` for params, which
arrive on the component's `params` prop.

```ts
routes: [
  { path: '', index: true,
    component: () => import('./GroceriesHome').then((m) => m.GroceriesHome) },
  { path: ':id', dynamic: true, gates: ['enabled'],
    component: () => import('./GroceryDetail').then((m) => m.GroceryDetail) },
],
```

`gates` wraps the route in `'enabled'` (app visibility) and/or `'superuser'`
guards. Set `dynamic: true` on routes with `:name` params so they aren't
prerendered.

## Flags & user settings

`flags` are household-wide; `userSettings` are per-user. Both share the
`AppFlagDef` shape and are read with `useAppFlag` / `useUserSetting`. See the
[App Flags](./app-flags) guide.

```ts
flags: {
  default_store: {
    type: 'string',            // 'string' | 'number' | 'boolean' | 'enum'
    label: 'Default store',
    description: 'Store id pre-selected when adding new grocery items.',
    default: '',
  },
},
```

`enum` flags also take `options: readonly string[]`. Every app additionally
gets an auto-injected `enabled` flag — don't declare your own.

## Widgets

Self-contained, zero-prop dashboard cards declared with a lazy `component`.
The dashboard discovers them across all apps and lays them out by `order`
(lower first; default `100`). See the [Dashboard Widgets](./widgets) guide.

```ts
widgets: [
  {
    id: 'groceries-remaining',   // globally unique; prefix with app id
    label: 'Groceries',
    component: () => import('./components/GroceriesWidget').then((m) => m.GroceriesWidget),
    order: 10,
  },
],
```

## Nested apps

Setting `children` makes an app a container. Each child is a full `AppConfig`
whose `basePath` must be a prefix of the parent's; the parent's index renders a
landing of child cards. Children get their own `enabled` flag (so they gate
independently) but stay out of top-level nav — the parent owns the placement.

```ts
{ id: 'finance', basePath: '/finance', /* ... */ children: [creditCardsApp, hsaApp] }
```
