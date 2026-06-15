---
name: setup-homestead
description: Stand up a new Homestead instance end-to-end — scaffold the project, first boot, claim the admin account, enable chat, and (optionally) install the systemd service. Use when the user asks to "set up homestead", "deploy homestead", "install on my server", "get started", or hits first-boot/claim/service problems.
---

# Set Up a Homestead Instance

Homestead runs as one Bun process launched by the `homestead` binary (or
straight from source). The operator's project holds all app code and
config; nothing is embedded in the binary. This skill walks a new
operator from zero to a claimed, optionally service-managed instance.

## Step 1: Check the host

```bash
homestead doctor
```

Interpret each ✓/⚠/✗ line for the user and fix failures before
continuing. No `homestead` binary yet? From a repo checkout, build it
with `make homestead` (produces `bin/homestead`), or run from source:
`bun packages/homestead-cli/src/cli.ts <cmd>`.

## Step 2: Scaffold the project

```bash
homestead init [<dir>]
```

This creates `homestead.config.ts` (the ONE file an operator edits to
choose apps), `package.json`, and an `apps/` dir for custom apps. Then
install dependencies in the project dir (`npm install` or
`bun install`).

## Step 3: First boot

```bash
homestead start            # production: builds the SPA, caches by content hash
homestead start --dev      # development: Vite middleware + HMR, same port
```

Useful flags: `--port=N` (the one port — SPA + the `/api/aep` engine,
default 3000), `--data-dir=PATH` (default `<project>/data`).

A fresh instance boots **unclaimed**. The first visit to the SPA shows a
one-shot form that creates the superuser account (`POST /api/setup`).
Tell the user to do this immediately — whoever visits first owns the
instance. A lost password is recovered with
`homestead admin reset-password [--email=EMAIL]` (prints the new one).

The schema sync runs in-process on every boot (idempotent, no admin env
vars needed); watch the boot log for `[resources]` errors.

## Step 4: Enable chat (optional but recommended)

The built-in chat app is Gemini-backed and needs `GEMINI_API_KEY` in the
server's environment — put it in the project's `.env`. Without it,
`POST /api/chat` returns an error and the rest of the app works fine.

## Step 5: Install as a service (optional, Linux + systemd)

```bash
sudo homestead install-service
```

This generates and enables `homestead.service`, which runs
`homestead start`. Other flags: `--service-name`, `--user`, `--port`,
`--data-dir`, `--env-file` (defaults to `<project>/.env` when present).

A running instance applies edits on its own: change `homestead.config.ts`
or the `apps/` tree and the launcher's `vite build --watch` rebuilds the
SPA while the server reapplies config (OAuth/app-access/schema); open tabs
poll `/api/app-version` and reload. To ship new code, point the project dir
at a git checkout and `git pull` (the running instance picks it up).

## Step 6: Verify

1. SPA loads on the public port and the admin can sign in.
2. Apps listed in `homestead.config.ts` appear in the nav.
3. `homestead resources` (bare) lists the synced resources over the
   loopback engine API.
4. If installed as a service: `systemctl status homestead`.

## Troubleshooting quick hits

- **Setup form never appears / "already claimed"** — the instance was
  claimed before; use `homestead admin reset-password`.
- **Schema sync failure on boot** — a `[resources]` error names the bad
  definition; fix the app's `resources.ts` (see the add-resource skill).
- **Port in use** — pass `--port` to move the one server port; the engine
  rides on it under `/api/aep`.
- **Stale SPA after config edits** — production builds are cached under
  `~/.homestead/cache/spa-builds/<hash>`; the hash covers config,
  lockfile, and git HEAD, so a rebuild happens automatically — check the
  launcher log if it didn't.
