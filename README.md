# Homestead

Homestead is my opinionated app for doing things at home.

It ships as a **single binary**. `homestead start` boots everything — the
[aepbase](https://www.github.com/rambleraptor/aepbase) backend, the Bun
sidecar, and a web server that serves the app — on one port. (aepbase and the
sidecar are baked into the binary — aepbase runs as a child process, the
sidecar in-process.)

## Features
- Grocery list with notifications
- HSA receipt upload
- Credit card perk tracker
- Gift card tracker

Each feature is an opt-in **module**. You pick which ones ship by editing a
single file, `homestead.config.ts`. Want a different mix, or your own
custom module? See **[docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)**.

## 🚀 Quick Start

### Prerequisites

To build the binary you need:

- **Go 1.25+** — compiles the launcher (aepbase is embedded as a library)
- **Node.js 20+ and npm** — builds the SPA
- **Bun** — compiles the sidecar ([install](https://bun.sh))

Pre-built binaries embed all three outputs, so a binary you download or
cross-compile via `make release` has no runtime dependency on Node, Bun, or
Go.

### Build and run

```bash
git clone https://github.com/rambleraptor/homestead.git
cd homestead
make homestead          # builds ./bin/homestead (SPA + sidecar + aepbase)
./bin/homestead start
```

`homestead start` prints a ready banner once everything is up:

```
[homestead] ready
[homestead]   app       http://localhost:3000
[homestead]   aepbase   http://127.0.0.1:8090
[homestead]   superuser admin@example.com / 9f3c…
```

Open the **app** URL and log in with the **superuser** credentials from the
banner. On first run aepbase generates them and saves them to the data dir;
change the password after you log in. That's the whole stack — no separate
terminals, env vars, or schema step.

> Prefer `make start` to build and run in one step.

## The `homestead` CLI

The binary is self-contained. Run `homestead help` for the full list.

### `homestead start`

Boots aepbase + the Bun sidecar + the web server using the
`homestead.config.ts` in the current directory.

```bash
homestead start                 # production build, http://localhost:3000
homestead start --dev           # serve the SPA via Vite with hot reload
homestead start --port=8080     # change the user-facing port
homestead start --data-dir=/var/lib/homestead   # where sqlite + files live
```

| Flag              | Default            | Purpose                                            |
|-------------------|--------------------|----------------------------------------------------|
| `--dev`           | off                | Serve the SPA via Vite (HMR) instead of the build  |
| `--port=N`        | `3000`             | User-facing port                                   |
| `--aepbase-port=N`| `8090`             | aepbase port (loopback only)                       |
| `--sidecar-port=N`| `4000`             | Sidecar port (loopback only)                       |
| `--vite-port=N`   | `5173`             | Vite dev server port (`--dev` only)                |
| `--data-dir=PATH` | `<project>/data`   | aepbase's sqlite db + uploaded files               |

Only `--port` is exposed to the outside world; aepbase and the sidecar bind
to loopback and are reached through the web server's same-origin proxy.

### `homestead init`

Scaffold a fresh project — a starter `homestead.config.ts` and a `modules/`
directory for your own features — in a new directory.

```bash
homestead init my-home
cd my-home
homestead start --dev
```

A directory is a Homestead project if it contains `homestead.config.ts`;
`homestead start` looks for it in the current directory.

### `homestead doctor`

Check whether the host can run `homestead start` (ports free, data dir
writable, …) before you start it.

```bash
homestead doctor
homestead doctor --port=8080 --aepbase-port=9000
```

## Architecture

A running Homestead is a single process that supervises three pieces behind
one web server:

- **aepbase** (child process) — a Go backend that serves an
  [AEP](https://www.aep.dev)-compliant REST API backed by SQLite. Holds all
  your data and binds to loopback.
- **sidecar** (Bun) — server-side APIs (notifications, OCR, scheduled
  actions) and the schema sync that registers each module's collections on
  boot.
- **web server** — the only outward-facing port. Serves the React SPA and
  proxies aepbase at same-origin `/api/aep` and the sidecar's routes.

Because the API is AEP-compliant, the frontend is optional: you can reach
your data through the AEP ecosystem (a Terraform provider, CLI, or the
[resource explorer UI](https://ui.aep.dev)).

### Modular design

Every feature is a **module** with its own:
- Components (`components/`)
- Hooks (`hooks/`)
- Types (`types.ts`)
- Configuration (`module.config.ts`) — declares the module's routes (with
  their React components), nav placement, dashboard widgets, and module
  flags

**Adding a module:**
1. Create `packages/homestead-modules/<your-module>/` with a
   `module.config.ts` that declares `routes` (each with a `component`)
2. Add the import + array entry to `homestead.config.ts`
3. Done — no per-route page files, no registry edits. The module appears in
   the navigation automatically and the router serves its routes.

The `create-module` skill scaffolds a new module end-to-end (resource
definitions, hooks, components, config wiring, and e2e fixtures).

## 🚀 Production Deployment

For a long-lived instance on a local machine (e.g. reachable over
Tailscale), the single binary runs cleanly under a process manager.

**[📖 Deployment Guide](deployment/README.md)** — systemd unit files,
management scripts, and sample production environment files.

## Development

Working on Homestead itself? The full contributor workflow, the make
targets (`make ci`, `make test`, `make test-e2e`), and the schema rules
live in [CLAUDE.md](CLAUDE.md).

## 📝 License

MIT License
