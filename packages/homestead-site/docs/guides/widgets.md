# Dashboard Widgets

A widget is a small React component your module contributes to the home
dashboard (`/dashboard`) — a compact, read-only summary of your module's data
(items left to buy, upcoming events, perks due soon) with a link that drills
into the full module. Add one when your module has an at-a-glance number or
list worth surfacing on the home screen.

## Table of Contents

- [Mental Model](#mental-model)
- [Add a Widget to Your Module](#add-a-widget-to-your-module)
- [WidgetCard](#widgetcard)
- [Conventions and Gotchas](#conventions-and-gotchas)
- [Existing Widgets](#existing-widgets)

---

## Mental Model

Widgets are self-contained components your module declares in its
`module.config.ts`. The dashboard discovers them from every installed module's
config, sorts them by `order` (lower first), and renders each one in a vertical
stack — filtered to the modules the viewer can access and reordered per the
viewer's saved preferences. Your widget fetches its own data and receives **no
props**. You don't touch any dashboard or registry code; declaring the widget
is enough for it to appear.

---

## Add a Widget to Your Module

Two steps: write the component, then register it in `module.config.ts`. Say you
want a `recipes` widget showing meals cooked this week.

### 1. Write the widget component

Put it under your module's `components/` folder, one file per widget named
`<Name>Widget.tsx`:

```
packages/homestead-modules/recipes/components/RecipesCookedThisWeekWidget.tsx
```

A widget takes no props, fetches its own data via a module-scoped hook, wraps
its content in `<WidgetCard>` for consistent chrome, and handles the loading
and empty states explicitly:

```tsx
import { ChefHat, Loader2 } from 'lucide-react';
import { WidgetCard } from '@rambleraptor/homestead-core/shared/components/WidgetCard';
import { useRecipeLogs } from '../hooks/useRecipeLogs';

export function RecipesCookedThisWeekWidget() {
  const { data: logs, isLoading } = useRecipeLogs({ since: 'this-week' });
  const count = logs?.length ?? 0;

  return (
    <WidgetCard
      icon={ChefHat}
      title="Cooked this week"
      href="/recipes"
      data-testid="recipes-cooked-this-week-widget"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
        </div>
      ) : count > 0 ? (
        <div className="flex items-baseline gap-2 py-2">
          <span className="font-display text-3xl text-text-main">{count}</span>
          <span className="font-body text-text-muted">
            {count === 1 ? 'meal cooked' : 'meals cooked'}
          </span>
        </div>
      ) : (
        <p className="font-body text-text-muted py-2">
          No meals logged yet this week.
        </p>
      )}
    </WidgetCard>
  );
}
```

Note the imports: shared chrome comes from the
`@rambleraptor/homestead-core/...` alias, while the module's own hook is a
relative `../hooks/...` import. If the data hook you need doesn't exist, add it
under `packages/homestead-modules/<feature>/hooks/` first; reuse an existing
hook when one already covers your data. There is no `'use client'` directive —
this is a Vite + React SPA, not Next.js.

### 2. Register the widget in `module.config.ts`

Append it to the module's `widgets` array. The `component` is a **lazy thunk**
(`() => import(...).then((m) => m.X)`), matching how routes and icons are
declared. Pick a **globally unique** id (prefix with the module id), give it a
human-readable `label` (shown in the dashboard customization UI), and choose an
`order` that positions it relative to widgets from other modules:

```ts
// packages/homestead-modules/recipes/module.config.ts
export const recipesModule: HomeModule = {
  // ...existing fields...
  widgets: [
    {
      id: 'recipes-cooked-this-week',
      label: 'Cooked this week',
      component: () =>
        import('./components/RecipesCookedThisWeekWidget').then(
          (m) => m.RecipesCookedThisWeekWidget,
        ),
      order: 30,
    },
  ],
};
```

For reference, here is the groceries module's declaration:

```ts
// packages/homestead-modules/groceries/module.config.ts
widgets: [
  {
    id: 'groceries-remaining',
    label: 'Groceries',
    component: () =>
      import('./components/GroceriesWidget').then((m) => m.GroceriesWidget),
    order: 10,
  },
],
```

That's it — the dashboard discovers your widget automatically; no registry
edits needed.

### 3. Verify and run the gate

```bash
make dev
# or, for the full stack: bun packages/homestead-cli/src/cli.ts start --dev
```

Visit `/dashboard` and confirm the widget appears in the right slot relative to
other widgets, then run `make ci && make test`. If you add an e2e check, follow
the existing widget testid pattern (`<feature>-widget` or
`<feature>-<slug>-widget`) so the Page Object can target it without CSS
selectors.

---

## WidgetCard

`<WidgetCard>` is the standard wrapper that gives every widget a consistent
look (rounded card, icon chip, link-style title, optional config gear, collapse
toggle). The props you'll use:

```ts
export interface WidgetCardProps {
  icon?: LucideIcon;          // header chip icon
  title: ReactNode;           // shown inside the link
  href: string;               // module home route
  configHref?: string;        // optional config page; renders a gear
  configLabel?: string;       // a11y label for the gear; defaults to "Configure widget"
  children?: ReactNode;       // body, hidden when collapsed
  defaultCollapsed?: boolean; // default false
  className?: string;         // outer card extras
  bodyClassName?: string;     // body wrapper extras
  'data-testid'?: string;     // outer card test id
}
```

Notes:

- The title is wrapped in a react-router `<Link to={href}>` (from
  `react-router-dom`, **not** `next/link`). Point `href` at your module's home
  route so users can drill in by clicking the title.
- When `configHref` is set, a settings gear renders in the header linking to
  the widget's configuration page (also a react-router `<Link>`). It exposes
  `data-testid="widget-config-link"`.
- Collapse state is local to the widget instance (not persisted). Keep
  `defaultCollapsed` `false` unless the body is expensive or noisy.
- The collapse toggle exposes `data-testid="widget-collapse-toggle"`; if you
  interact with it in e2e tests, scope the lookup to your widget's outer testid.

---

## Conventions and Gotchas

**Naming**

- Component file: `<Name>Widget.tsx` under
  `packages/homestead-modules/<feature>/components/`.
- Widget id: `<module-id>-<slug>` (e.g. `groceries-remaining`,
  `events-upcoming`). Ids must be unique across the whole app.
- Test id: same as the widget id with a `-widget` suffix, or just
  `<module>-widget` when the module only has one.

**Order values**

`order` controls global widget ordering, not per-module. Choose values with
gaps (10, 20, 30, …) so future widgets can slot in without renumbering. The
default is `100`; widgets without an explicit order land at the bottom in
declaration order. The viewer can override this ordering (and hide widgets)
through the dashboard customization UI, so `order` is the default, not a
guarantee.

**Data fetching**

- Use a React Query hook from your module's `hooks/` directory. The widget
  benefits from the same cache as the rest of the module — the dashboard won't
  refetch data the user already loaded elsewhere. Prefer queries the rest of
  the app already runs; cheap fetches matter since widgets load on the
  dashboard regardless of which module the user opens next.
- Always render an `isLoading` branch and an empty branch. Avoid showing `0`
  with no context; phrase the empty state in plain English.

**Visuals**

- Wrap the body in `<WidgetCard>` rather than a custom container — the
  dashboard relies on consistent card geometry.
- Keep widgets compact. The dashboard column is `max-w-3xl`; widgets that need
  more space should link out to a full-page view via the title `href`.
- Use the project palette (`text-text-main`, `text-text-muted`,
  `font-display`, `font-body`, `bg-surface-white`, `text-brand-navy`, etc.).

**Don'ts**

- Don't accept props on a widget component. The contract is zero-prop
  components. If a widget needs configuration, wire it through module flags
  (`HomeModule.flags`) and read the value with `useModuleFlag(...)` from
  `@rambleraptor/homestead-core/settings`.
- Don't import another module's components into your widget. Modules stay
  self-contained.
- Don't write data from a widget. Widgets are read-only summaries; provide a
  CTA that links into the module for mutations.
- Don't import eagerly — keep the lazy `component: () => import(...)` form so
  your widget code stays code-split out of the main bundle.
- Don't add `'use client'` or import from `next/*` — this is a Vite SPA.

---

## Existing Widgets

The widgets already in the repo are good references when you write your own
(e.g. `packages/homestead-modules/groceries/components/GroceriesWidget.tsx`).
Find the current list with:

```bash
grep -rn "widgets:" packages/homestead-modules/*/module.config.ts
```
