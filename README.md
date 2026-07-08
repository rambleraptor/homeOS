<div align="center">

<img src="packages/homestead-site/public/homestead-icon.png" alt="Homestead" width="116" />

# Homestead

**Build and deploy apps for you, your family, and your agents**

[website](https://myhomestead.dev)&nbsp; · &nbsp;[install](#install)&nbsp; · &nbsp;[quick start](#quick-start)&nbsp; · &nbsp;[apps](#included-apps)&nbsp; · &nbsp;[architecture](#architecture)&nbsp; · &nbsp;[agents](#agents-can-use-homestead-too)&nbsp; · &nbsp;[docs](packages/homestead-site/docs/guides/index.md)

</div>

---

Homestead is a self-hosted personal platform for your apps. Homestead starts
as your own personal database with an authenticated, standardized API. When
you're ready, you can add on CLI-based agent support, a React frontend, AI chatbots,
and more.

## Install

macOS or Linux, x64 or arm64. Requires [Node.js](https://nodejs.org) 22.13 or
newer:

```bash
npm install -g @rambleraptor/homestead-cli
```

That puts the `homestead` command on your `PATH`. Prefer not to install
globally? Run it on demand with `npx`:

```bash
npx @rambleraptor/homestead-cli init my-home
```

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
[homestead]   engine    http://localhost:3000/api/v1/aep
```

## Core Concepts

- **App** - Every app is self-contained in a folder with an app.config.ts file. This defines
  your data models, React code, routes, and more.
- **Resources** - The data model(s) for your app. Defining a resource schema
  in your app.config.ts creates the database schema and APIs to manage your data.
- **`homestead.config.ts`** — homestead reads your homestead.config.ts to understand all of your apps,  authentication information, and more.
- **homestead CLI** — a TypeScript CLI that serves your homestead instance. Just point it at your       homestead.config.ts

## Agents Can Use Homestead Too

Because the API is AEP-compliant, the frontend is optional — your data is
reachable across the AEP ecosystem and your existing agentic workflows:

- ✅ **typed REST API** — apps declare real resources, so an agent can discover
  the shape of the system and write against the same backend the UI uses.
- ✅ **chat assistant** — an AI chatbot (OpenAI, Anthropic, or Gemini) over your
  structured data, built into the app.
- ✅ **agent-friendly CLI** — drive resources from the terminal and existing
  agent tooling.
- ✅ **resource explorer** — browse and edit through the AEP
  [resource explorer UI](https://ui.aep.dev) or a Terraform provider.

Apps declare resources instead of hiding state inside components, so agents get
secure access to your structured, personal data — no scraping UI state, no
guessing how an app works.

## Included Apps

Homestead began as a way for me to easily build personal apps. I ship all
of my personal apps in the @rambleraptor/homestead-apps package. This includes:

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

The CLI is how you create projects, run the full stack, and check whether a
machine is ready to host Homestead. Run `homestead help` for the full list.

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

There is one port; the engine is reached through the same-origin `/api/v1/aep`
routes on it.

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
