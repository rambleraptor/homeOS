# Installation

Get Homestead running on your machine. You install one CLI, create a project, and start it.

You need [Node.js](https://nodejs.org) 22.13 or newer. Homestead runs on macOS and Linux (arm64 and x86-64).

This page covers:

- [Install the CLI](#install-the-cli)
- [Run your first instance](#run-your-first-instance)
- [Build from source](#build-from-source)

---

## Install the CLI

Install the `homestead` command:

```bash
npm install -g @rambleraptor/homestead-cli
```

Check it works:

```bash
homestead --help
```

To skip the global install, run the commands below with `npx @rambleraptor/homestead-cli` in place of `homestead`.

---

## Run your first instance

Create a project and start it:

```bash
homestead init my-home
```

```bash
cd my-home
```

```bash
homestead start
```

`homestead init` creates the project files — `homestead.config.ts` (picks your apps), `package.json`, and an `apps/` folder for your own apps — then installs the dependencies. If `homestead start` ever runs before they're installed, it installs them first.

`homestead start` boots the stack on port 3000 and prints a banner:

```
[homestead] ready
[homestead]   app       http://localhost:3000
[homestead]   engine    http://localhost:3000/api/v1/aep
[homestead]   login     first visit asks you to create the admin account
```

Open the **app** URL. The first visit asks you to create the admin account with an email and password.

To edit your site later, change `homestead.config.ts`. The running instance picks up the change without a reinstall.

Lost your password? Run this from the project directory to set a new one:

```bash
homestead admin reset-password
```

Next: [add your own app](./quick-start).

---

## Build from source

Build from a checkout if you're working on Homestead itself or want unreleased changes. This path needs **Node 22.13+** and **Bun**.

Clone and install dependencies:

```bash
git clone https://github.com/rambleraptor/homestead
```

```bash
cd homestead
```

```bash
make install
```

Build the launcher and run it:

```bash
make homestead
```

```bash
./bin/homestead start
```

To run the full dev stack (server plus web UI with hot reload) instead of the compiled binary:

```bash
make dev
```

This serves on port 3000, the same as `homestead start`. It runs `bun packages/homestead-cli/src/cli.ts start --dev`, which you can also run directly.
