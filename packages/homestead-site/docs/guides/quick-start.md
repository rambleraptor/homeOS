# Quick Start: A Grocery List

This guide builds a working **Grocery List** app under your project's
`apps/` directory — a page that adds items and lists them, backed by its
own aepbase collection. No config wiring needed.

An app is one object that follows the `AppConfig` shape: an id, a name, an
icon, a base path, routes, and optionally the `resources` (collections) it
owns. A route points at a React component.

> Shortcut: `homestead init-app grocery` scaffolds all of the below in one
> command.

## 1. Declare the collection and app

Create a folder under `apps/` and add an `app.homestead.ts` that
default-exports the config. It declares one `grocery-item` collection and
one route. The `icon` and route `component` are lazy imports.

```ts
// apps/grocery/app.homestead.ts
import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';

const groceryApp: AppConfig = {
  id: 'grocery',
  name: 'Grocery',
  description: 'A shared grocery list.',
  icon: () => import('lucide-react').then((m) => m.ShoppingCart),
  basePath: '/grocery',
  section: 'Home',
  routes: [
    { path: '', index: true, component: () => import('./GroceryHome').then((m) => m.GroceryHome) },
  ],
  resources: [
    {
      singular: 'grocery-item',
      plural: 'grocery-items',
      user_settable_create: true,
      fields: {
        name: { type: 'string', required: true },
        checked: { type: 'boolean', default: false },
      },
    },
  ],
};

export default groceryApp;
```

The collection is created automatically on boot by the schema sync. Field
names stay snake_case; `singular` / `plural` stay kebab-case.

## 2. Write the page component

The page reads the list with the aepbase client and adds items to it.

```tsx
// apps/grocery/GroceryHome.tsx
import { useEffect, useState } from 'react';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';

type Item = { id: string; name: string };

export function GroceryHome() {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState('');

  const load = () => aepbase.list<Item>('grocery-items').then(setItems);
  useEffect(() => void load(), []);

  async function add() {
    if (!name.trim()) return;
    await aepbase.create('grocery-items', { name });
    setName('');
    load();
  }

  return (
    <div className="p-6">
      <h1 className="font-display text-2xl">Grocery List</h1>
      <div className="my-4 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <button onClick={add}>Add</button>
      </div>
      <ul>{items.map((i) => <li key={i.id}>{i.name}</li>)}</ul>
    </div>
  );
}
```

## 3. Start it

```bash
homestead start
```

That's it — any `apps/<dir>/app.homestead.ts` is discovered automatically
at boot and merged with the apps listed in `homestead.config.ts`. Open the
app, sign in, and go to `/grocery`. The app appears in the sidebar under
its `section`.

The explicit `apps` array in `homestead.config.ts` still works exactly as
before — use it for npm-installed apps, or when you want to wire an app in
by hand (an explicit entry wins if both declare the same id).

## Next steps

Your list now persists. From here an app can do much more:

- **[Widgets](./widgets)** — add a "items remaining" card to the dashboard.
- **[App Flags](./app-flags)** — add typed, household-wide settings.
- **[Notifications](./notifications)** — send push notifications to users.
- **[Bulk Import](./bulk-import)** — let users import rows from a CSV.
