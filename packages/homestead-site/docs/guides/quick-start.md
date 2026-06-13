# Quick Start: Your First App

Apps are Homestead's version of apps. This guide builds a minimal
"Hello World" app under your project's `apps/` directory and starts it —
no config wiring needed.

Every app is one object that follows the `AppConfig` shape: an id, a name,
an icon, a base path, and one or more routes. A route points at a React
component.

> Shortcut: `homestead init-app hello` scaffolds all of the below (plus a
> starter resource definition) in one command.

## 1. Write the page component

Create a folder for your app under `apps/` and add a component for its page.

```tsx
// apps/hello/HelloHome.tsx
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

Add an `app.homestead.ts` next to the component, default-exporting the
config. The `icon` and route `component` are lazy imports.

```ts
// apps/hello/app.homestead.ts
import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';

const helloApp: AppConfig = {
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

export default helloApp;
```

## 3. Start it

```bash
homestead start
```

That's it — any `apps/<dir>/app.homestead.ts` is discovered automatically
at boot and merged with the apps listed in `homestead.config.ts`. Open the
app, sign in, and go to `/hello`. The app appears in the sidebar under its
`section`.

The explicit `apps` array in `homestead.config.ts` still works exactly as
before — use it for npm-installed apps, or when you want to wire an app in
by hand (an explicit entry wins if both declare the same id).

## Next steps

An app can do much more than render a page:

- **[Widgets](./widgets)** — add a summary card to the dashboard.
- **[App Flags](./app-flags)** — add typed, household-wide settings.
- **[Notifications](./notifications)** — send push notifications to users.
- **[Bulk Import](./bulk-import)** — let users import rows from a CSV.
