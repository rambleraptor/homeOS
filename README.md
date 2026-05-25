# Homestead

**A self-hosted, modular dashboard for the stuff you run at home.**

Track groceries, gift cards, credit card perks, HSA receipts, recipes,
todos, and more — all in one place, all on hardware you own.

```
┌─────────────────────────────────────────────────────────┐
│  Homestead  =  Next.js PWA  +  aepbase (AEP REST)       │
│                                                         │
│  • Your data lives in a local SQLite file               │
│  • Pick which modules to enable in one config file      │
│  • Works offline, installs as a PWA on phone/desktop    │
└─────────────────────────────────────────────────────────┘
```

## Why Homestead?

- **Your data, your machine.** No SaaS, no telemetry, no account to
  cancel. aepbase keeps everything in `aepbase/data/` — a single SQLite
  database plus uploaded files. Back it up with `cp`.
- **Pick what you want.** Homestead ships ~10 modules (groceries, gift
  cards, credit cards, HSA, recipes, todos, …). Enable only the ones
  you'll use by editing one file (`frontend/homestead.config.ts`). The
  rest don't load, don't run schema, don't clutter the nav.
- **Open standard backend.** aepbase implements the
  [AEP](https://www.aep.dev) REST spec, so your data is reachable from
  any AEP client — including a Terraform provider, a CLI, and the
  [resource explorer UI](https://ui.aep.dev). The Homestead frontend is
  optional; the data outlives it.
- **Built for a household.** Multi-user from day one, web push
  notifications, OCR for receipts, an offline-first React Query cache
  so the grocery list works in the basement.
- **Hackable.** Every feature is a self-contained TypeScript module
  with its own schema, hooks, and components. Fork a module, change
  one, write your own — the registry picks it up.

## Features (built-in modules)

| Module        | What it does                                                |
|---------------|-------------------------------------------------------------|
| Groceries     | Shared shopping list with push notifications                |
| Gift Cards    | Track balances and transactions per card                    |
| Credit Cards  | Perks + redemptions, with reminders                         |
| HSA           | Upload receipts (OCR via Gemini), tag for tax season        |
| Recipes       | Recipes + cook logs                                         |
| Todos         | Shared household todos                                      |
| People        | Lightweight contacts for who-owes-who and gift planning     |
| Notifications | Web push delivery + per-user subscriptions                  |
| Dashboard     | Module widgets on the home screen                           |
| Games         | Game-night tracker (experimental)                           |

Self-hosters opt in by listing the modules they want in
`frontend/homestead.config.ts`. See
[`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md) for the walkthrough.

## Quick Start

### Prerequisites

- Node.js 20+ and npm
- Go 1.25+ (to build the aepbase binary)
- Linux, macOS, or WSL

### Install

```bash
git clone https://github.com/rambleraptor/homestead.git
cd homestead
npm install
```

### Run

```bash
# Terminal 1 — aepbase (the backend)
cd aepbase
./install.sh         # first time only — builds bin/aepbase
./run.sh             # serves on :8090
```

On first start, aepbase prints the superuser email + password to
stdout. **Save them.** You'll log in with these and set them as
`AEPBASE_ADMIN_EMAIL` / `AEPBASE_ADMIN_PASSWORD` so the schema sync
runs at boot.

```bash
# Terminal 2 — Next.js frontend
cd frontend
cp .env.example .env             # then edit AEPBASE_ADMIN_* values
npm run dev
```

Open `http://localhost:3000` and sign in with the superuser
credentials. The frontend proxies aepbase at same-origin `/api/aep`.

## Deployment

For a long-running install on a home server (with optional Tailscale
access and auto-updates), see the
**[Deployment Guide](deployment/README.md)**. It covers systemd unit
files, log management, backups, and a `make deploy` workflow with
rollback.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Next.js PWA  (frontend/)                               │
│  ├─ React + TanStack Query (offline-first cache)        │
│  ├─ Module registry (packages/homestead-modules/*)      │
│  └─ /api/aep proxy ─────┐                               │
└──────────────────────────│──────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│  aepbase  (aepbase/, Go)                                │
│  ├─ AEP-compliant REST API                              │
│  ├─ SQLite + file uploads (data/)                       │
│  └─ Schema applied at frontend boot (idempotent)        │
└─────────────────────────────────────────────────────────┘
```

Schema lives next to each module
(`packages/homestead-modules/<feature>/resources.ts`). On Next.js boot,
`frontend/src/instrumentation.ts` diffs every declared definition
against aepbase and POST/PATCHes the result — so adding a module is a
TypeScript edit + a restart, not a migration.

### Adding a module

1. Create `packages/homestead-modules/<your-module>/` with a
   `module.config.ts` declaring routes, nav placement, and (optionally)
   widgets and flags.
2. Add the import to `frontend/homestead.config.ts`.
3. Restart. The catch-all router (`app/(app)/[...slug]/page.tsx`)
   serves your routes; the registry handles nav, dashboard, and schema
   sync.

No per-route `page.tsx` files. No registry edits beyond the config.

## Project layout

```
homestead/
├── frontend/                       Next.js app (PWA + API routes)
│   └── homestead.config.ts         ⭐ which modules are enabled
├── packages/
│   ├── homestead-core/             shared types, registry, API client
│   └── homestead-modules/          feature modules (one dir each)
├── aepbase/                        Go backend (AEP REST + SQLite)
├── deployment/                     systemd units, deploy/rollback scripts
├── docs/
│   └── SELF_HOSTING.md             operator-facing setup walkthrough
└── tests/e2e/                      Playwright end-to-end suite
```

## Development

```bash
make ci          # lint + type-check + build
make test        # Vitest unit/integration
make test-e2e    # Playwright (against a real aepbase)
```

See [`CLAUDE.md`](CLAUDE.md) for the contributor playbook —
architecture rules, schema constraints, e2e conventions, and the
pre-PR gate.

## License

[MIT](LICENSE)
