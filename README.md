<div align="center">

<img src="packages/homestead-site/public/homestead-icon.png" alt="Homestead" width="116" />

# Homestead

**Build and deploy apps for you, your family, and your agents**

a self-hosted platform for personal apps — private software you shape for your
own life, run on your own server, and expose through a backend that agents can
actually understand.

[website](https://myhomestead.dev)&nbsp; · &nbsp;[install](#install)&nbsp; · &nbsp;[quick start](#quick-start)&nbsp; · &nbsp;[apps](#included-apps)&nbsp; · &nbsp;[architecture](#architecture)&nbsp; · &nbsp;[agents](#agents-can-use-homestead-too)&nbsp; · &nbsp;[docs](packages/homestead-site/docs/guides/index.md)

</div>

---

Building a personal app is too hard. You need a developer account, App Review,
sideloading — and you still have to run a backend, for software only your
family will ever open. Homestead ships that whole foundation as one binary, so
you write just the part that's yours.

`homestead start` boots the entire stack in a single process on one port: the
React app, the [AEP](https://www.aep.dev)-compliant TypeScript backend, the
schema sync, and a same-origin web server. Open the URL, log in, done.

It's warm personal infrastructure with a small agent-native app OS underneath:
apps give people useful surfaces, while the AEP backend gives humans *and*
agents a structured API over the same data.

## Install

macOS or Linux, x64 or arm64:

```bash
curl -fsSL https://raw.githubusercontent.com/rambleraptor/homestead/main/scripts/install.sh | bash
```

The installer downloads the right prebuilt binary, verifies it against the
release checksums, and drops it at `~/.local/bin/homestead`. Point it elsewhere
or pin a version with env vars:

```bash
curl -fsSL https://raw.githubusercontent.com/rambleraptor/homestead/main/scripts/install.sh \
  | HOMESTEAD_INSTALL_DIR=/usr/local/bin HOMESTEAD_VERSION=v0.1.0 bash
```

Prebuilt binaries embed the SPA and the server — no Node, Bun, or Go at runtime.

## Quick Start

```bash
homestead init my-home     # scaffold a project (homestead.config.ts + apps/)
cd my-home
homestead start            # boot the whole stack on http://localhost:3000
```

`homestead start` prints a ready banner once everything is up:

```
[homestead] ready
[homestead]   app       http://localhost:3000
[homestead]   engine    http://localhost:3000/api/aep
[homestead]   superuser printed on first boot; reset with `homestead admin reset-password`
```

Open the **app** URL and log in with the superuser password printed once on
first boot (rotate it any time with `homestead admin reset-password`). That's
the whole stack — no separate terminals, env vars, or schema step.

## Core Concepts

- **apps** — every feature is a self-contained app: routes, data, widgets, and
  settings in one folder. You pick which ones ship by editing a single file.
- **`homestead.config.ts`** — a project is any directory with this file. It
  chooses the apps that ship and is where you wire in your own.
- **the engine** — a TypeScript backend serving an AEP-compliant REST API over
  SQLite, reachable only under the same-origin `/api/aep` prefix.
- **schema sync** — declare resources in TypeScript; the schema syncs on boot,
  creating, patching, and ordering tables for you. No migrations to hand-write.
- **family access** — users, sessions, and a superuser exist from first boot.
  OAuth sign-in and per-app access gating keep Uncle Mike out of your date-night
  app.

## How It Compares

|                          | roll your own        | a SaaS app         | homestead                          |
| ------------------------ | -------------------- | ------------------ | ---------------------------------- |
| backend to run           | you assemble it      | someone else's     | one binary, included               |
| App Store + review       | required for native  | n/a                | none — just open the URL           |
| family auth & access     | you build it         | per-product silos  | built in (OAuth + access gating)   |
| agent-ready API          | you design it        | rarely, if ever    | AEP REST, discovered on boot       |
| where your data lives    | depends              | their servers      | local SQLite on hardware you own   |
| your own custom apps     | unlimited effort     | impossible         | a folder + one line of config      |

## Agents Can Use Homestead Too

Because the API is AEP-compliant, the frontend is optional — your data is
reachable across the AEP ecosystem and your existing agentic workflows:

- ✅ **typed REST API** — apps declare real resources, so an agent can discover
  the shape of the system and write against the same backend the UI uses.
- ✅ **chat assistant** — a Gemini-backed chatbot over your structured data,
  built into the app.
- ✅ **agent-friendly CLI** — drive resources from the terminal and existing
  agent tooling.
- ✅ **resource explorer** — browse and edit through the AEP
  [resource explorer UI](https://ui.aep.dev) or a Terraform provider.

Apps declare resources instead of hiding state inside components, so agents get
secure access to your structured, personal data — no scraping UI state, no
guessing how an app works.

## Included Apps

Homestead ships with a growing set of opt-in apps:

- Todos and projects
- Groceries with notifications and image processing
- People and shared personal data
- Recipes
- Gift card tracking
- Credit card perk tracking
- HSA receipt upload
- Games and small social scorekeepers

Each is an opt-in **app** — turn it on by editing `homestead.config.ts`. Want a
different mix, or your own custom app? See the
**[docs](packages/homestead-site/docs/guides/index.md)**. The `create-app`
skill scaffolds a new app end-to-end (resources, hooks, components, config
wiring, and e2e fixtures).

## The Homestead CLI

The binary is self-contained — it's how you create projects, run the full
stack, and check whether a machine is ready to host Homestead. Run
`homestead help` for the full list.

| command                         | what it does                                                        |
| ------------------------------- | ------------------------------------------------------------------- |
| `homestead init <dir>`          | scaffold a fresh project (`homestead.config.ts` + `apps/`)          |
| `homestead start`               | boot the server (engine API + app routes + SPA)                     |
| `homestead start --dev`         | serve the SPA via Vite with hot reload                              |
| `homestead start --port=N`      | change the user-facing port (default `3000`)                        |
| `homestead start --data-dir=P`  | where the sqlite db + uploaded files live (default `<project>/data`)|
| `homestead doctor`              | check a host can run `homestead start` before you commit to it      |
| `homestead install-service`     | generate + enable the systemd unit (sudo)                           |
| `homestead admin reset-password`| rotate the superuser password                                       |

There is one port; the engine is reached through the same-origin `/api/aep`
routes on it.

## Architecture

A running Homestead is personal infrastructure in one process on a single port:

- **engine** — a TypeScript backend serving an AEP-compliant REST API backed by
  SQLite. Holds all your data, reachable only under same-origin `/api/aep`.
- **public web server** — the one port. Serves the React SPA, the engine, and
  the server-side APIs (notifications, chat, app custom methods). The schema
  sync registers each app's collections on boot.

### Modular Design

Every feature is an **app** with its own:

- Components (`components/`)
- Hooks (`hooks/`)
- Types (`types.ts`)
- Configuration (`app.config.ts`) — declares routes (with their React
  components), nav placement, dashboard widgets, and app flags

**Adding an app:**

1. Create `packages/homestead-apps/<your-app>/` with an `app.config.ts` that
   declares `routes` (each with a `component`)
2. Add the import + array entry to `homestead.config.ts`
3. Done — no per-route page files, no registry edits. The app appears in the
   navigation automatically and the router serves its routes.

## Production Deployment

For a long-lived instance on a local machine (e.g. reachable over Tailscale),
the single binary runs cleanly under systemd:

```bash
sudo homestead install-service
sudo systemctl start homestead
```

The running instance watches your project: edit `homestead.config.ts` or the
`apps/` tree and it rebuilds the SPA and reapplies config on its own, and open
tabs reload — no separate update step. Point the project dir at a git checkout
and `git pull` when you want to ship new code.

## Configuration

Everything an instance serves comes from `homestead.config.ts` at the project
root: the `apps` array, OAuth providers (`auth.oauth`), and the per-app access
map. Apps under `apps/<dir>/app.homestead.ts` are auto-discovered and merged
in. See the [configuration guide](packages/homestead-site/docs/guides/index.md).

## Docs

- [Quick Start](packages/homestead-site/docs/guides/quick-start.md)
- [Installation](packages/homestead-site/docs/guides/installation.md)
- [Defining Resources](packages/homestead-site/docs/guides/resources.md)
- [State Management](packages/homestead-site/docs/guides/state-management.md)
- [Dashboard Widgets](packages/homestead-site/docs/guides/widgets.md)
- [Notifications](packages/homestead-site/docs/guides/notifications.md)
- [AI Support](packages/homestead-site/docs/guides/ai.md)
- [Creating Users](packages/homestead-site/docs/guides/users.md)
- [Access & Tags](packages/homestead-site/docs/guides/access.md)

## Development

Working on Homestead itself requires the source toolchain:

- **Node.js 20+ and npm** — builds the SPA
- **Bun** — runs and compiles the server + CLI ([install](https://bun.sh))

```bash
git clone https://github.com/rambleraptor/homestead.git
cd homestead
make homestead          # builds ./bin/homestead for your current platform
make release            # cross-compiles release binaries
```

Use `make start` to build and run the source checkout in one step. The full
contributor workflow and the make targets (`make ci`, `make test`,
`make test-e2e`) live in [CLAUDE.md](CLAUDE.md).

### Publishing Releases

Push a semver tag to publish prebuilt binaries:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The release workflow runs tests, cross-compiles Linux/macOS binaries for x64 and
arm64, packages them as `.tar.gz` archives, writes `SHA256SUMS`, and uploads
everything to the GitHub Release. `scripts/install.sh` downloads from those
release assets.

## License

MIT License
