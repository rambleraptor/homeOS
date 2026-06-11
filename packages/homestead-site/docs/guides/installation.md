# Installation

Homestead is a single binary. Install it, then run two commands to get a live
instance. No Node, Bun, or Go needed at runtime.

Homestead runs on macOS and Linux (arm64 and x86-64).

## Install the CLI

```bash
curl -fsSL https://raw.githubusercontent.com/rambleraptor/homestead/main/scripts/install.sh | bash
```

This downloads the right binary for your platform, verifies it, and installs it
to `~/.local/bin/homestead`.

To install somewhere else or pin a version, set these first:

| Variable                | Effect                                  |
| ----------------------- | --------------------------------------- |
| `HOMESTEAD_INSTALL_DIR` | Where to install (e.g. `/usr/local/bin`). |
| `HOMESTEAD_VERSION`     | A specific release (e.g. `v0.1.0`).       |

Make sure the install directory is on your `PATH`, then check it works:

```bash
homestead --help
```

## Run your first instance

```bash
homestead init my-home
cd my-home
homestead start
```

`homestead init` creates a project: a `homestead.config.ts` that picks your
apps, plus a `apps/` folder for your own.

`homestead start` boots the whole stack on one port and prints a banner:

```
[homestead] ready
[homestead]   app       http://localhost:3000
[homestead]   engine    http://127.0.0.1:8090 (loopback)
[homestead]   superuser printed on first boot; reset with `homestead admin reset-password`
```

The superuser is created for you on first boot, and its password is printed
**once** above the banner. Open the **app** URL and log in with it. If you
lose the password, run `homestead admin reset-password` from the project
directory to rotate it.

Next: [add your own app](./quick-start).

## Build from source

Build from a checkout if you're working on Homestead itself or want unreleased
changes. This path needs **Node 20+** and **Bun**.

```bash
git clone https://github.com/rambleraptor/homestead
cd homestead
make install       # install workspace dependencies
```

Build the single binary and run it:

```bash
make homestead     # → bin/homestead (SPA + server embedded)
./bin/homestead start
```

To develop with hot reload instead of a compiled binary:

```bash
bun packages/homestead-cli/src/cli.ts start --dev
```

To work on just the web app against a running backend, `make dev` starts the
Vite dev server on port 5173.
