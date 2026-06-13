# Claude AI Assistant Guidelines for Homestead

This document gives both Claude and human contributors the ground rules for
working on the Homestead repo. The backend is **homestead-server**
(`packages/homestead-server`) — one process (Bun, or Node ≥ 22.13 via tsx;
the runtime seams are `src/listen.ts`, `src/engine/sqlite.ts`, and
`src/engine/password.ts`) containing the **engine** (a
TypeScript rewrite of aepbase: an AEP-compliant dynamic REST server over
SQLite, with users/auth, OAuth, file fields, and app-access gating baked in)
plus the API routes the SPA can't serve itself (test notifications, the
Gemini-backed chat, the AEP-136 custom-method gateway) and the boot-time
schema sync. The frontend is a **Vite + React SPA** (`react-router-dom`) that
talks to the engine through same-origin `/api/aep` routes; in dev, Vite runs
in middleware mode *inside* the server process (single port, HMR included).
In production the `homestead` launcher (`packages/homestead-cli`, compiled
with Bun into a thin binary) runs the server as a runtime child (bun, or
node + tsx when bun isn't installed) resolved from
the project's node_modules, serving a SPA the launcher builds on the box
(content-hash cached; rebuilt + restarted automatically when
`homestead.config.ts` changes — open tabs poll `/api/app-version` and
reload). Nothing is embedded in the binary: app code and config live in the
operator's project. The engine listens on two ports: the public one (SPA +
/api/*) and a loopback-only "engine API" port (:8090, bare aepbase-style
paths) used by server-side helpers, e2e, and `homestead resources`.

## Table of Contents

- [Pull Request Requirements](#pull-request-requirements)
- [Development Workflow](#development-workflow)
- [Testing Guidelines](#testing-guidelines)
- [Code Quality Standards](#code-quality-standards)
- [Project Structure](#project-structure)
- [aepbase schema (TypeScript)](#aepbase-schema-typescript)

## Pull Request Requirements

**Every PR MUST pass the following checks before being pushed:**

### 1. Build ✅

```bash
make build
# or: cd packages/homestead-app && npm run build
```

### 2. Lint ✅

```bash
make lint
# or: cd packages/homestead-app && npm run lint
```

### 3. Type Check ✅

```bash
make type-check
# or: cd packages/homestead-app && npm run type-check
```

### 4. Tests ✅

```bash
make test                  # Vitest (frontend) + Bun (CLI/server unit tests)
make test-node             # CLI/server unit tests under Node (vitest)
make test-e2e              # Playwright end-to-end tests
```

The CLI/server test files import from `vitest`, which `bun test` aliases to
`bun:test` — the same suite runs under both runtimes. Don't use Bun-only
APIs (`Bun.*`, `bun:sqlite`, `import.meta.dir`) in server/CLI code or tests;
go through the runtime seams above or use `node:*` equivalents.

## Development Workflow

### Full local stack

Everything runs in one process — Bun or Node both work. From source, no
compile step is needed:

```bash
bun packages/homestead-cli/src/cli.ts start --dev
# or run the server directly:
bun packages/homestead-server/src/index.ts --dev

# the same, under Node (>= 22.13, for node:sqlite):
npx tsx packages/homestead-cli/src/cli.ts start --dev
npx tsx packages/homestead-server/src/index.ts --dev
```

To build and run the production launcher binary instead:

```bash
make homestead             # → bin/homestead (thin launcher; SPA builds at boot)
./bin/homestead start
```

A fresh instance boots **unclaimed**: the first visit to the SPA asks you to
create the admin account (`POST /api/setup`, one-shot). Recover a lost
password with `homestead admin reset-password`. The schema sync runs
in-process on boot — no admin env vars needed.

In dev mode Vite runs in middleware mode inside the server (see
`packages/homestead-server/src/dev-vite.ts`), so the SPA, HMR, and all
`/api/*` routes share one port. There is no separate Vite proxy config.

### Pre-push checklist

```bash
make ci && make test
```

This runs lint, type-check, build, and unit tests. Run `make test-e2e`
separately when you've changed anything data-adjacent.

### Recommended process

1. Create a feature branch
2. Make your changes; follow the existing app architecture
3. Run the full gate: `make ci && make test && make test-e2e`
4. Commit with a clear message and push

## Testing Guidelines

### Frontend unit/integration tests

Vitest + Testing Library. Tests live next to the code they cover, under
`__tests__/` directories. `src/test/setup.ts` mocks the aepbase client
globally — individual tests can override behavior via `vi.mocked(...)`.

### End-to-end (E2E) tests

Playwright against a real aepbase instance. Located in `tests/e2e/`.

```bash
make test-e2e               # headless run
make test-e2e-ui            # interactive UI mode
```

E2E best practices (CRITICAL — follow these to keep the suite reliable):

#### 1. Test isolation
Each test gets its own user (see fixtures) and cleans its own data in
`beforeEach`. Don't rely on data from other tests.

#### 2. Waiting
NEVER use `page.waitForTimeout(ms)`. Use Playwright's auto-waits, explicit
`waitFor({ state })` calls, or `expect().toBeVisible()` (which has built-in
retries).

#### 3. Selectors (priority order)
1. `data-testid` — stable, semantic
2. Role-based: `getByRole('button', { name: /add/i })`
3. Label: `getByLabel(/email/i)`
4. Text — only for verifying displayed content

Avoid CSS class selectors and positional selectors.

#### 4. Page Object Model
All e2e tests use POMs under `tests/e2e/pages/`. POMs encapsulate page
interactions; they don't contain assertions (except helper `expect…`
methods) or `console.log` statements.

#### 5. Test data setup
Seed via aepbase REST (`tests/e2e/utils/aepbase-helpers.ts`), not through
the UI. API seed is 10-100× faster.

#### 6. Adding a new app

1. Add `data-testid` attrs on key buttons/forms
2. Create a Page Object at `tests/e2e/pages/<App>Page.ts`
3. Add aepbase helpers (`create<App>`, `deleteAll<Apps>`)
4. Create specs at `tests/e2e/tests/<app>/<app>-crud.spec.ts`
5. Run: `cd tests/e2e && npm run test -- tests/<app>/`

## Code Quality Standards

### TypeScript
- Strict type checking (see `tsconfig.json`)
- Avoid `any`; use proper types. If you truly need `unknown`, narrow it.
- Export types that might be reused
- Use interfaces for object shapes

### React
- Functional components with hooks
- Custom hooks for reusable logic
- Follow the modular architecture pattern below

### Modular architecture

Feature apps ship in the `@rambleraptor/homestead-apps` workspace
package at `packages/homestead-apps/<feature>/`. The registry, the
`AppConfig`/`AppFlagDef` types, and the always-installed core apps
(`settings`, `superuser`, `users`, `chat`) live in the
`@rambleraptor/homestead-core` package (`packages/homestead-core/`) because
they are part of the core experience. `packages/homestead-app/src/apps/registry.ts` is
just a boot shim that installs the registry singleton with the operator's
apps from `homestead.config.ts` plus those core apps.

Every feature is a self-contained app:

```
packages/homestead-apps/<feature>/
├── components/         # UI components
├── hooks/              # Custom hooks (data access lives here)
├── types.ts            # TypeScript types
├── app.config.ts    # App metadata (imports AppConfig from @rambleraptor/homestead-core/apps/types)
└── index.ts            # Public exports
```

Consumers import via the package, e.g.
`import { GiftCardHome } from '@rambleraptor/homestead-apps/gift-cards/components/GiftCardHome'`.
The package resolves `@rambleraptor/homestead-core/...` through the npm
workspace and a TypeScript path alias defined in
`packages/homestead-apps/tsconfig.json`; Vite resolves the workspace
packages natively (no Next.js `transpilePackages`).

The list of apps served by an instance comes from two places, merged at
boot: the explicit `apps` array in `homestead.config.ts` (at the repo
root), plus any auto-discovered `apps/<dir>/app.homestead.ts` files in
the project's `apps/` directory (each default-exports its `AppConfig`;
an explicit config entry wins on an id collision). The SPA discovers
them at build time (`import.meta.glob` in the boot shim) and the server
at boot (`@rambleraptor/homestead-core/server/app-discovery`); the
shared validation/merge helpers live in
`@rambleraptor/homestead-core/apps/discovery`. Routes are declared inline on each
`AppRoute` (the `component` field). The SPA's react-router setup
(`packages/homestead-app/src/App.tsx`) sends every unmatched path to the catch-all
renderer in `packages/homestead-app/src/apps/AppRoute.tsx`, which resolves the
route's lazy component — there are no per-route page files. See
[`packages/homestead-site/docs/guides/quick-start.md`](packages/homestead-site/docs/guides/quick-start.md)
for the operator-facing walkthrough.

### Style
- Meaningful variable / function names
- Prefer self-documenting code; add comments only for non-obvious "why"
- Keep functions small and focused
- No premature optimization

## Project Structure

The repo is an npm workspace. The root `package.json` declares
`workspaces: ["packages/*", "tests/e2e"]`; install once at the
root with `npm install`.

### Frontend SPA (`packages/homestead-app/`)

The Vite + React SPA is a thin shell — most app code lives in the
`homestead-core` and `homestead-apps` packages.

- `src/main.tsx` — SPA entry; mounts `<App>` under `BrowserRouter` and
  installs the app registry singleton (`src/apps/registry.ts`)
- `src/App.tsx` — react-router routes; authenticated pages render inside
  the `AppShell`, with a catch-all that dispatches to `AppRoute`
- `src/apps/AppRoute.tsx` — catch-all renderer that resolves a
  path to its app's lazy component
- `vite.config.ts` — dev server + `/api/*` proxy config

### Core package (`packages/homestead-core/`)

The `@rambleraptor/homestead-core` workspace package. Holds everything the
SPA and apps share:

- `api/aepbase.ts` — thin REST client wrapper for the engine (client-side)
- `server/aepbase.ts` — server-side engine helper used by homestead-server's
  routes (the client-side wrapper uses localStorage, so server code uses
  this instead; it talks to the loopback engine API)
- `auth/` — AuthContext, types, route guards
- `apps/` — registry, the `AppConfig`/`AppFlagDef` contract types
- `settings/`, `superuser/`, `users/`, `chat/` — the always-installed core
  apps (`chat` is the Gemini-backed assistant; its server half lives in
  `server/chat/`)
- `layout/`, `shared/`, `resources/`, `app-flags/`, `user-settings/` —
  shared chrome, components, and schema/sync plumbing

### Feature apps package (`packages/homestead-apps/`)

The user-facing feature apps (`credit-cards`, `dashboard`, `events`,
`games`, `gift-cards`, `groceries`, `hsa`, `notifications`, `people`,
`recipes`, `todos`) live here as the `@rambleraptor/homestead-apps`
workspace package. Apps import `@rambleraptor/homestead-core/...`
through the workspace + a TypeScript path alias defined in
`packages/homestead-apps/tsconfig.json`.

### Server (`packages/homestead-server/`)

The whole backend in one Bun process:

- `src/engine/` — the AEP engine (TypeScript port of aepbase): dynamic
  resources over SQLite (`db.ts`, `registry.ts`, `router.ts`, `crud.ts`,
  `store.ts`), `/aep-resource-definitions` (`meta.ts`), users + bearer auth
  (`users.ts`), OAuth (`oauth.ts`), file fields (`files.ts`), app-access
  gating (`access.ts`), a minimal list-filter parser (`filter.ts`), and the
  OpenAPI generator (`openapi.ts`). Features are baked in — there is no
  middleware/plugin layer.
- `src/routes/` — the API routes the SPA can't serve itself:
  `POST /api/notifications/send-test`, `POST /api/chat` (Gemini chat;
  requires `GEMINI_API_KEY`), `GET /api/custom-methods`, and the
  `/api/aep` gateway (`aep-gateway.ts`) that dispatches AEP-136 custom
  methods and passes everything else to the engine in-process.
- `src/server.ts` — `startServer()`: two listeners (public + loopback
  engine API on :8090), superuser bootstrap (`src/bootstrap.ts` — a fresh
  instance boots unclaimed with a pending superuser; `/api/setup` +
  the SPA's first-visit form claim it; exports `createSuperuser` /
  `claimSetup` / `needsSetup` / `resetSuperuserPassword` /
  `mintAdminToken`), and the boot-time schema sync (`src/schema-sync.ts`,
  which mints a short-lived admin token in its own db — no admin env vars).
- `src/dev-vite.ts` — dev mode: Vite middleware + HMR inside the same
  process, one port.
- `src/app-registry.js` — JS indirection that initializes the app registry
  from the repo-root `homestead.config.ts` (incl. `auth.oauth` and the
  app-access map) without dragging the React app graph into `tsc`.
- `test/` — `bun test` suite, including Go-parity behavioral tests and an
  OpenAPI snapshot/round-trip check against
  `test/fixtures/openapi-go-snapshot.json`.

### Launcher (`packages/homestead-cli/`)

A Bun TypeScript CLI, compiled by `make homestead` into a thin
`bin/homestead` binary. The binary cannot import the operator's config
in-process (compiled Bun executables have no node_modules resolution at
runtime), so everything project-shaped runs as a `bun` child inside the
project dir:

- `homestead start` (prod): builds the SPA via the project's vite into
  `~/.homestead/cache/spa-builds/<hash>` (`src/spa-build.ts`; hash of
  config + the `apps/` tree + lockfile + git HEAD, so unchanged projects
  boot instantly), then spawns
  `bun .../homestead-server/src/index.ts --spa-dist <dir>`.
  It watches `homestead.config.ts` / `package-lock.json` / the `apps/`
  tree (auto-discovered apps) and, on change,
  rebuilds the SPA and restarts the server child (idempotent schema sync
  reruns on boot); open tabs poll `/api/app-version` and reload.
- `homestead start --dev`: `bun --watch` child with Vite middleware (HMR).
- `homestead update` pulls the project's git checkout (tracking the
  checkout's own upstream — `git branch -u` to change it, `origin/main` when
  unset), runs `bun install` when package.json or a lockfile changed, and
  restarts the systemd service when it's behind — the "edit config from your
  phone" flow. systemd is optional: without the unit, update just syncs the
  checkout and a running `homestead start` applies the changes itself.
- `homestead admin reset-password` and the `resources` token mint run as bun
  children of the project's homestead-server (`src/tools/`), so the binary
  bundles zero engine code and can never write to a db with stale logic.

Other commands: `init`, `doctor`, `install-service` (sudo; installs the
systemd service + an auto-update timer running `update` on
`--update-interval`, default 5m), `resources`, `admin reset-password`.

### Deployment

Systemd-based deployment is driven entirely by the launcher:
`sudo homestead install-service` generates + enables the `homestead.service`
unit plus a `homestead-update.timer`/`.service` that runs `homestead update`
on a cadence. No separate scripts or source checkout required.

## aepbase schema (TypeScript)

Each feature app owns the schema for the aepbase collections it
manages. Definitions live alongside the app in a `resources.ts` file
and are wired into the app's config via `resources: [...]` on the
exported `AppConfig`. Resource definitions that don't belong to a
feature app (`user-preference`, `action`, `run`) live in
`packages/homestead-core/resources/builtins.ts`.

Apps declare fields in the authoring-friendly `FieldDef` shape
(`packages/homestead-core/resources/types.ts`) — a `fields` map with
per-field `required` booleans, `enum` for allowed string values,
`type: 'file'` for uploads, and optional `singular_name`/`plural_name`
display names — never raw JSON schema:

```ts
fields: {
  merchant: { type: 'string', required: true },
  status: { type: 'string', enum: ['pending', 'done'] },
  front_image: { type: 'file', description: 'jpeg/png, <=5MB' },
}
```

At server boot, `packages/homestead-server/src/schema-sync.ts`
aggregates every declared definition through `getAllResourceDefs()` plus
`BUILTIN_RESOURCE_DEFS`, validates names, topologically sorts by
`parents`, translates each `fields` map to aepbase's JSON-schema wire
format (`@rambleraptor/homestead-core/resources/translate.ts`), and
applies the result via the engine's `/aep-resource-definitions`
endpoint, using a short-lived admin token minted directly in the db (no
env vars). The runner (`@rambleraptor/homestead-core/resources/sync.ts`)
is idempotent: it creates missing definitions, patches drifted ones, and
no-ops when everything is in sync.

The e2e suite boots the same server, so e2e and runtime schema stay in
sync by construction.

### Adding a new resource

1. Add a new entry in the relevant app's `resources.ts` (or in
   `packages/homestead-core/resources/builtins.ts` if it's
   platform-level).
2. Restart the server; the new definition is created on boot.
3. If the change is to an existing definition, the runner emits a
   PATCH automatically.

### Rules (aepbase constraints, not TS-specific)

1. **Singular/plural must be kebab-case.** `gift-card`, not `giftCard`.
   aepbase rejects URL params with uppercase letters. The sync runner
   validates this (and field names) at boot and fails fast.
2. **Allowed string values go in `enum: [...]`.** aepbase strips
   JSON-schema `enum` on round-trip, so the translator encodes the
   values into the wire `description` (`one of: pending, done`); the
   chat tool builder passes them to Gemini as a real enum. There is no
   `minimum`/`maximum` support.
3. **Field names stay snake_case** (e.g. `card_number`,
   `created_by`, `service_date`).
4. **Don't add autodate fields** (`created`, `updated`). aepbase
   manages `create_time` and `update_time` itself (note the underscore).
5. **aepbase disallows `type` changes and `parents` changes** on an
   existing resource definition. Delete + recreate the definition
   (destructive!) if you need either.
6. **File fields**: declare with `type: 'file'`. The translator emits
   aepbase's `binary` + `x-aepbase-file-field` wire encoding (never
   write those yourself). The engine writes files under
   `data/files/...` and exposes a `:download` custom method.
7. **`singular` is globally unique.** The registry throws on
   duplicate declarations across apps.

### Parent / child relationships

| Child                       | Parent        | URL pattern                                                 |
|-----------------------------|---------------|-------------------------------------------------------------|
| `transaction`               | `gift-card`   | `/gift-cards/{id}/transactions/{id}`                        |
| `perk`                      | `credit-card` | `/credit-cards/{id}/perks/{id}`                             |
| `redemption`                | `perk`        | `/credit-cards/{id}/perks/{id}/redemptions/{id}`            |
| `run`                       | `action`      | `/actions/{id}/runs/{id}`                                   |
| `log`                       | `recipe`      | `/recipes/{id}/logs/{id}`                                   |
| `notification`              | `user`        | `/users/{id}/notifications/{id}`                            |
| `notification-subscription` | `user`        | `/users/{id}/notification-subscriptions/{id}`               |
| `user-preference`           | `user`        | `/users/{id}/preferences/{id}` (note the prefix strip)      |

Parent-keyed children don't carry the parent id as a stored field; it's
encoded in the URL path. Declare via `parents: ['<parent-singular>']`
in the resource definition; the runner orders applies so parents land
first.

### Not yet modeled

- Per-collection access rules (row-level security beyond user parenting)
- Realtime subscriptions (polling only)
- Thumbnail generation for file fields

### App flags

The `app-flags` resource is generated dynamically from declared
app flags rather than defined statically. Each app can declare
typed flags in its `app.config.ts` (`flags: { ... }`). At server
boot, the schema sync aggregates every declared flag (via
`getAllAppFlagDefs` in
`@rambleraptor/homestead-core/apps/registry`), builds a JSON-schema
payload, and POST/PATCHes it against aepbase's
`/aep-resource-definitions` endpoint. One record of `app-flags` is
the household-wide singleton; fields are flattened as
`${appId_snake}__${key}` on the wire.

Consumers: `useAppFlag(appId, key)` from
`@rambleraptor/homestead-core/settings` is the one public hook for
reading/writing a single flag from any component.

---

## For Claude AI Assistants

1. **Always run the full gate** (`make ci && make test`) before marking
   work complete.
2. **Follow the modular architecture** — don't create monolithic
   components. App hooks own their data access.
3. **Respect existing patterns** — review similar code before implementing.
4. **Use the aepbase wrapper** (`@rambleraptor/homestead-core/api/aepbase`)
   for client-side data access, and
   `@rambleraptor/homestead-core/server/aepbase` for server-side routes.
5. **Ask before touching schema** — `resources.ts` changes affect real data.
6. **Security first** — validate inputs, sanitize outputs, follow OWASP.

### Before every PR push

```bash
make ci && make test
```

Only push when all checks pass.
