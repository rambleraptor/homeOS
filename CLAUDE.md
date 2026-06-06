# Claude AI Assistant Guidelines for Homestead

This document gives both Claude and human contributors the ground rules for
working on the Homestead repo. The backend is **aepbase** (an AEP-compliant
dynamic REST server). The frontend is a **Vite + React SPA**
(`react-router-dom`) that talks to aepbase through a same-origin `/api/aep`
proxy. A small **Bun + Hono sidecar** owns the few API routes the SPA can't
serve itself (test notifications, module workers) and runs
the schema sync. In production a single Bun-compiled binary — the `homestead`
launcher (`packages/homestead-cli`) — spawns aepbase as a child process and
serves the sidecar in-process, behind the embedded SPA. The SPA, the sidecar's
code, and the aepbase binary are all baked into the launcher binary. aepbase
itself is a small Go binary (`aepbase/`) configured entirely via flags + env.

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
make test                  # Vitest (frontend unit/integration tests)
make test-e2e              # Playwright end-to-end tests
```

## Development Workflow

### Full local stack

The `homestead` launcher orchestrates the whole stack. In dev mode it spawns
aepbase (the Go binary), the Bun sidecar, and the Vite dev server. From source
you can run it directly with Bun (no compile needed); building the aepbase
binary once is the only prerequisite:

```bash
make aepbase               # build aepbase/bin/aepbase (Go)
bun packages/homestead-cli/src/cli.ts start --dev
```

To build and run the production single binary instead:

```bash
make homestead             # → bin/homestead (SPA + sidecar + aepbase embedded)
./bin/homestead start
```

On aepbase's first start, the superuser's email + password are printed to
stdout. Save them; you'll need them to log in to the app and to set
`AEPBASE_ADMIN_EMAIL` / `AEPBASE_ADMIN_PASSWORD` in the sidecar's
environment so its boot-time schema sync runs.

For pure frontend iteration against an already-running backend + sidecar,
`make dev` starts just the Vite dev server (port 5173); it proxies
`/api/aep` to aepbase and the other `/api/*` routes to the sidecar (see
`packages/homestead-app/vite.config.ts`). aepbase can also be run standalone via
`aepbase/install.sh` + `aepbase/run.sh` (serves on :8090).

### Pre-push checklist

```bash
make ci && make test
```

This runs lint, type-check, build, and unit tests. Run `make test-e2e`
separately when you've changed anything data-adjacent.

### Recommended process

1. Create a feature branch
2. Make your changes; follow the existing module architecture
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

#### 6. Adding a new module

1. Add `data-testid` attrs on key buttons/forms
2. Create a Page Object at `tests/e2e/pages/<Module>Page.ts`
3. Add aepbase helpers (`create<Module>`, `deleteAll<Modules>`)
4. Create specs at `tests/e2e/tests/<module>/<module>-crud.spec.ts`
5. Run: `cd tests/e2e && npm run test -- tests/<module>/`

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

Feature modules ship in the `@rambleraptor/homestead-modules` workspace
package at `packages/homestead-modules/<feature>/`. The registry, the
`HomeModule`/`ModuleFlagDef` types, and the always-installed core modules
(`settings`, `superuser`, `users`) live in the
`@rambleraptor/homestead-core` package (`packages/homestead-core/`) because
they are part of the core experience. `packages/homestead-app/src/modules/registry.ts` is
just a boot shim that installs the registry singleton with the operator's
modules from `homestead.config.ts` plus those core modules.

Every feature is a self-contained module:

```
packages/homestead-modules/<feature>/
├── components/         # UI components
├── hooks/              # Custom hooks (data access lives here)
├── types.ts            # TypeScript types
├── module.config.ts    # Module metadata (imports HomeModule from @rambleraptor/homestead-core/modules/types)
└── index.ts            # Public exports
```

Consumers import via the package, e.g.
`import { GiftCardHome } from '@rambleraptor/homestead-modules/gift-cards/components/GiftCardHome'`.
The package resolves `@rambleraptor/homestead-core/...` through the npm
workspace and a TypeScript path alias defined in
`packages/homestead-modules/tsconfig.json`; Vite resolves the workspace
packages natively (no Next.js `transpilePackages`).

The list of modules served by an instance lives in
`homestead.config.ts` (at the repo root) — that is the only file an operator edits
to add or remove a module. Routes are declared inline on each
`ModuleRoute` (the `component` field). The SPA's react-router setup
(`packages/homestead-app/src/App.tsx`) sends every unmatched path to the catch-all
renderer in `packages/homestead-app/src/modules/ModuleRoute.tsx`, which resolves the
route's lazy component — there are no per-route page files. See
[`packages/homestead-site/docs/guides/self-hosting.md`](packages/homestead-site/docs/guides/self-hosting.md)
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
`homestead-core` and `homestead-modules` packages.

- `src/main.tsx` — SPA entry; mounts `<App>` under `BrowserRouter` and
  installs the module registry singleton (`src/modules/registry.ts`)
- `src/App.tsx` — react-router routes; authenticated pages render inside
  the `AppShell`, with a catch-all that dispatches to `ModuleRoute`
- `src/modules/ModuleRoute.tsx` — catch-all renderer that resolves a
  path to its module's lazy component
- `vite.config.ts` — dev server + `/api/*` proxy config

### Core package (`packages/homestead-core/`)

The `@rambleraptor/homestead-core` workspace package. Holds everything the
SPA and modules share:

- `api/aepbase.ts` — thin REST client wrapper for aepbase (client-side)
- `server/aepbase.ts` — server-side aepbase helper used by the sidecar
  routes (the client-side wrapper uses localStorage, so the sidecar uses
  this instead)
- `auth/` — AuthContext, types, route guards
- `modules/` — registry, the `HomeModule`/`ModuleFlagDef` contract types
- `settings/`, `superuser/`, `users/` — the always-installed core modules
- `layout/`, `shared/`, `resources/`, `module-flags/`, `user-settings/` —
  shared chrome, components, and schema/sync plumbing

### Feature modules package (`packages/homestead-modules/`)

The user-facing feature modules (`credit-cards`, `dashboard`, `events`,
`games`, `gift-cards`, `groceries`, `hsa`, `notifications`, `people`,
`recipes`, `todos`) live here as the `@rambleraptor/homestead-modules`
workspace package. Modules import `@rambleraptor/homestead-core/...`
through the workspace + a TypeScript path alias defined in
`packages/homestead-modules/tsconfig.json`.

### Sidecar (`packages/homestead-sidecar/`)

A small Bun + Hono server (`src/server.ts`) that owns the API routes the
SPA can't serve itself: `POST /api/notifications/send-test` and
`ALL /api/modules/:moduleId/*` (module workers). It also runs the
boot-time schema sync (`src/schema-sync.ts`).

### Launcher (`packages/homestead-cli/`)

A Bun TypeScript CLI. `homestead start` spawns aepbase as a child process,
serves the sidecar's Hono app in-process (in `--dev` the sidecar is a
`bun --watch` child instead, for hot reload, alongside the Vite dev server),
serves the SPA, and reverse-proxies `/api/*` to the sidecar / aepbase. It reads
`homestead.config.ts` natively — including `auth.oauth`, which it serializes
into the aepbase child's `AEPBASE_OAUTH` env var. `make homestead` compiles it
with `bun build --compile` into a single `bin/homestead` that embeds the SPA,
the sidecar code (bundled JS), and the aepbase binary (extracted to
`~/.homestead/cache` — or `HOMESTEAD_CACHE_DIR` — on first boot). Commands:
`start [--dev]`, `init`, `doctor`. See `src/embedded.generated.ts` (a
build-time stub; the real form is generated by `scripts/gen-embedded.ts`).

### Backend (`aepbase/`)

- `main.go` — a standalone, fully env/flag-configured aepbase host. It opts
  into `EnableUsers` + `EnableFileFields`, enables OAuth from `AEPBASE_OAUTH`
  (see `oauth.go`), bootstraps the superuser and persists its credentials to
  `data/credentials.json` (see `bootstrap.go`), restores resource definitions,
  and shuts down gracefully on SIGTERM. The launcher spawns it as a child.
- `install.sh` / `run.sh` — build + run the binary standalone on :8090.
- `data/` — sqlite db + uploaded files + `credentials.json` (gitignored)

### Deployment (`deployment/`)

Systemd-based deployment. See `deployment/README.md`.

## aepbase schema (TypeScript)

Each feature module owns the schema for the aepbase collections it
manages. Definitions live alongside the module in a `resources.ts` file
and are wired into the module's config via `resources: [...]` on the
exported `HomeModule`. Resource definitions that don't belong to a
feature module (`user-preference`, `action`, `run`) live in
`packages/homestead-core/resources/builtins.ts`.

At sidecar boot, `packages/homestead-sidecar/src/schema-sync.ts`
aggregates every declared definition through `getAllResourceDefs()` plus
`BUILTIN_RESOURCE_DEFS`, topologically sorts by `parents`, and applies
the result via aepbase's `/aep-resource-definitions` endpoint. The
runner (`@rambleraptor/homestead-core/resources/sync.ts`) is
idempotent: it creates missing definitions, patches drifted ones, and
no-ops when everything is in sync.

Set `AEPBASE_ADMIN_EMAIL` and `AEPBASE_ADMIN_PASSWORD` in the sidecar's
environment to enable the sync. Without them the app still serves
pages but aepbase will return 404 for unregistered collections — bring
up the sidecar with credentials at least once after a schema change.

The same runner is used by the e2e bootstrap
(`tests/e2e/config/apply-schema.ts`) so e2e and runtime stay in sync.

### Adding a new resource

1. Add a new entry in the relevant module's `resources.ts` (or in
   `packages/homestead-core/resources/builtins.ts` if it's
   platform-level).
2. Restart the sidecar with admin creds set; the new definition is
   created on boot.
3. If the change is to an existing definition, the runner emits a
   PATCH automatically.

### Rules (aepbase constraints, not TS-specific)

1. **Singular/plural must be kebab-case.** `gift-card`, not `giftCard`.
   aepbase rejects URL params with uppercase letters.
2. **JSON-schema `enum`, `minimum`, `maximum` are stripped on round-trip.**
   Encode allowed values in `description`:
   ```ts
   status: { type: 'string', description: 'one of: pending, success, error' }
   ```
3. **Schema field names stay snake_case** (e.g. `card_number`,
   `created_by`, `service_date`).
4. **Don't add autodate fields** (`created`, `updated`). aepbase
   manages `create_time` and `update_time` itself (note the underscore).
5. **aepbase disallows `type` changes and `parents` changes** on an
   existing resource definition. Delete + recreate the definition
   (destructive!) if you need either.
6. **File fields**: declare with `type: 'binary'` and
   `'x-aepbase-file-field': true`. aepbase writes files under
   `aepbase/data/files/...` and exposes a `:download` custom method.
7. **`singular` is globally unique.** The registry throws on
   duplicate declarations across modules.

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

### Module flags

The `module-flags` resource is generated dynamically from declared
module flags rather than defined statically. Each module can declare
typed flags in its `module.config.ts` (`flags: { ... }`). At sidecar
boot, the schema sync aggregates every declared flag (via
`getAllModuleFlagDefs` in
`@rambleraptor/homestead-core/modules/registry`), builds a JSON-schema
payload, and POST/PATCHes it against aepbase's
`/aep-resource-definitions` endpoint. One record of `module-flags` is
the household-wide singleton; fields are flattened as
`${moduleId_snake}__${key}` on the wire.

Consumers: `useModuleFlag(moduleId, key)` from
`@rambleraptor/homestead-core/settings` is the one public hook for
reading/writing a single flag from any component.

---

## For Claude AI Assistants

1. **Always run the full gate** (`make ci && make test`) before marking
   work complete.
2. **Follow the modular architecture** — don't create monolithic
   components. Module hooks own their data access.
3. **Respect existing patterns** — review similar code before implementing.
4. **Use the aepbase wrapper** (`@rambleraptor/homestead-core/api/aepbase`)
   for client-side data access, and
   `@rambleraptor/homestead-core/server/aepbase` for the sidecar routes.
5. **Ask before touching schema** — `resources.ts` changes affect real data.
6. **Security first** — validate inputs, sanitize outputs, follow OWASP.

### Before every PR push

```bash
make ci && make test
```

Only push when all checks pass.
