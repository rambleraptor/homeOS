# Quick Start: Your First App

Apps are Homestead's version of apps. This guide builds a minimal
"Hello World" app, adds it to your config, and starts it.

Every app is one object that follows the `AppConfig` shape: an id, a name,
an icon, a base path, and one or more routes. A route points at a React
component.

## 1. Write the page component

Create a folder for your app and add a component for its page.

```tsx
// packages/homestead-apps/hello/HelloHome.tsx
export function HelloHome() {
  return (
    <div className="p-6">
      <h1 className="font-display text-2xl">Hello, World</h1>
      <p className="text-text-muted">My first Homestead app.</p>
    </div>
  );
}
```

## 2. Declare the app

Add a `app.config.ts` next to the component. The `icon` and route
`component` are lazy imports.

```ts
// packages/homestead-apps/hello/app.config.ts
import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';

export const helloApp: AppConfig = {
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

Import the app in `homestead.config.ts` and add it to the `apps` array.

```ts
// homestead.config.ts
import { helloApp } from '@rambleraptor/homestead-apps/hello/app.config';

const config: HomesteadConfig = {
  apps: [
    // ...existing apps
    helloApp,
  ],
};
```

## 4. Start it

```bash
make start
```

Open the app, sign in, and go to `/hello`. The app appears in the sidebar
under its `section`.

## Next steps

An app can do much more than render a page:

- **[Widgets](./widgets)** — add a summary card to the dashboard.
- **[App Flags](./app-flags)** — add typed, household-wide settings.
- **[Notifications](./notifications)** — send push notifications to users.
- **[Bulk Import](./bulk-import)** — let users import rows from a CSV.
