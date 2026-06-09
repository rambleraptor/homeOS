# Homestead

Homestead is a full-stack platform for personal apps: private software you
can shape for your own life, run on your own server, and expose through a
backend that agents can actually understand.

The product is intentionally CLI-first. Install the `homestead` binary, put it
on a home server, and `homestead start` boots the whole stack: the React app,
the [aepbase](https://www.github.com/rambleraptor/aepbase) backend, the Bun
sidecar, schema sync, and a same-origin web server on one public port.

Homestead is warm personal infrastructure with a little agent-native app OS
underneath: modules give you useful app surfaces, while the AEP-compliant
backend gives humans and agents a structured API for the same data.

## Why Homestead

- **One binary for a real stack** — ship the SPA, backend, sidecar, and web
  proxy together instead of assembling a small constellation of services.
- **Built for home servers** — keep a long-lived personal app platform on a
  mini PC, private VPS, or machine reachable over Tailscale.
- **Agent-accessible by design** — every module can expose AEP resources, so
  agents can inspect schemas, call APIs, and help build or operate features
  without scraping UI state.
- **Modular personal software** — start with useful apps, then add the
  specific workflows that commercial SaaS will never prioritize.

## Included modules

Homestead ships with a growing set of opt-in modules:

- Todos and projects
- Groceries with notifications and image processing
- People and shared personal data
- Recipes
- Gift card tracking
- Credit card perk tracking
- HSA receipt upload
- Games and small social scorekeepers

Each feature is an opt-in **module**. You pick which ones ship by editing a
single file, `homestead.config.ts`. Want a different mix, or your own
custom module? See the **[docs](packages/homestead-site/docs/guides/index.md)**.

## Quick start

### Install the CLI

```bash
curl -fsSL https://raw.githubusercontent.com/rambleraptor/homestead/main/scripts/install.sh | bash
```

The installer downloads the right prebuilt binary for macOS or Linux, verifies
it against the release checksums, and installs it to `~/.local/bin/homestead`
by default. Set `HOMESTEAD_INSTALL_DIR=/usr/local/bin` or
`HOMESTEAD_VERSION=v0.1.0` if you need a different destination or version.

Prebuilt binaries embed the SPA, sidecar code, and aepbase binary. They do not
need Node, Bun, or Go at runtime.

### Create and run a personal app workspace

```bash
homestead init my-home
cd my-home
homestead start
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

A Homestead project is a directory with `homestead.config.ts`. That file
chooses the modules that ship and becomes the natural place to add your own
personal app surfaces.

## The `homestead` CLI

The binary is self-contained. It is the way you create projects, run the full
stack, and check whether a machine is ready to host Homestead. Run
`homestead help` for the full list.

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

A running Homestead is personal infrastructure in one supervised process. It
coordinates three pieces behind one web server:

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

That API surface is also what makes Homestead practical for agents. Modules
declare real resources instead of hiding state inside components, so an agent
can discover the shape of the system, write against the same backend the UI
uses, and help create new modules without guessing how the app works.

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

## Production deployment

For a long-lived instance on a local machine (e.g. reachable over
Tailscale), the single binary runs cleanly under systemd. Install the
service and an auto-update timer with one command:

```bash
sudo homestead install-service --update-interval=5m
sudo systemctl start homestead
```

`homestead update` keeps the box in sync with your config repo — edit
`homestead.config.ts` from anywhere, push, and the timer pulls + restarts.

## Development

Working on Homestead itself requires the source toolchain:

- **Go 1.25+** — compiles the launcher (aepbase is embedded as a library)
- **Node.js 20+ and npm** — builds the SPA
- **Bun** — compiles the sidecar ([install](https://bun.sh))

```bash
git clone https://github.com/rambleraptor/homestead.git
cd homestead
make homestead          # builds ./bin/homestead for your current platform
make release            # cross-compiles release binaries
```

Use `make start` to build and run the source checkout in one step.

The full contributor workflow, the make targets (`make ci`, `make test`,
`make test-e2e`), and the schema rules live in [CLAUDE.md](CLAUDE.md).

## Publishing releases

Push a semver tag to publish prebuilt binaries:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The release workflow runs tests, cross-compiles Linux/macOS binaries for x64
and arm64, packages them as `.tar.gz` archives, writes `SHA256SUMS`, and
uploads everything to the GitHub Release. `scripts/install.sh` downloads from
those release assets.

## 📝 License

MIT License
