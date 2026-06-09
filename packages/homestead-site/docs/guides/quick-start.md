# Quick Start: Your First Module

Modules are Homestead's version of apps. This guide builds a minimal
"Hello World" app, adds it to your config, and starts it.

Every module is one object that follows the `HomeModule` shape: an id, a name,
an icon, a base path, and one or more routes. A route points at a React
component.

## 1. Write the page component

Create a folder for your module and add a component for its page.

```tsx
// packages/homestead-modules/hello/HelloHome.tsx
export function HelloHome() {
  return (
    <div className="p-6">
      <h1 className="font-display text-2xl">Hello, World</h1>
      <p className="text-text-muted">My first Homestead app.</p>
    </div>
  );
}
```

## 2. Declare the module

Add a `module.config.ts` next to the component. The `icon` and route
`component` are lazy imports.

```ts
// packages/homestead-modules/hello/module.config.ts
import type { HomeModule } from '@rambleraptor/homestead-core/modules/types';

export const helloModule: HomeModule = {
  id: 'hello',
  name: 'Hello',
  description: 'My first Homestead app.',
  icon: () => import('lucide-react').then((m) => m.Hand),
  basePath: '/hello',
  section: 'Home',
  routes: [
    {
      path: '',
      index: true,
      component: () => import('./HelloHome').then((m) => m.HelloHome),
    },
  ],
};
```

## 3. Add it to your config

Import the module in `homestead.config.ts` and add it to the `modules` array.

```ts
// homestead.config.ts
import { helloModule } from '@rambleraptor/homestead-modules/hello/module.config';

const config: HomesteadConfig = {
  modules: [
    // ...existing modules
    helloModule,
  ],
};
```

## 4. Start it

```bash
make start
```

Open the app, sign in, and go to `/hello`. The module appears in the sidebar
under its `section`.

## Next steps

An app can do much more than render a page:

- **[Widgets](./widgets)** — add a summary card to the dashboard.
- **[Module Flags](./module-flags)** — add typed, household-wide settings.
- **[Notifications](./notifications)** — send push notifications to users.
- **[Bulk Import](./bulk-import)** — let users import rows from a CSV.
