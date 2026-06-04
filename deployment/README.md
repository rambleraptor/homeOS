# Homestead Deployment Guide

Homestead deploys as a **single binary**. `homestead start` (a Bun-compiled
CLI) spawns aepbase as a child process (its binary is extracted from the
launcher at boot), serves the Bun sidecar (notifications + receipt OCR)
in-process, and serves the embedded SPA behind one user-facing port. One
systemd service supervises it.

> Migrated from the old two-service layout (a separate `aepbase` Go binary
> plus a Next.js `npm start` server), and then from the Go single-binary
> launcher. Everything now lives in the `homestead` binary built by
> `make homestead`.

## Quick Setup

```bash
# 1. Configure environment
# The build + service read frontend/.env. Ensure it has your VAPID keys
# (and GEMINI_API_KEY if used). See frontend/.env.example.
# Generate VAPID keys: cd frontend && npx web-push generate-vapid-keys

# 2. Build the single binary (embeds SPA + sidecar)
./deployment/build.sh

# 3. Install + enable the systemd service
sudo make setup-services

# 4. Start it
sudo make start-services

# 5. Open http://localhost:3000
```

On first start against an empty data dir, homestead generates a superuser
and writes its credentials to `<data-dir>/credentials.json`. Read them with:

```bash
cat aepbase/data/credentials.json
```

## Prerequisites

The **build host** (here, the device itself) needs:

- **Bun** — compiles the launcher CLI + the sidecar
  (`curl -fsSL https://bun.sh/install | bash`).
- **Go 1.25+** — builds the aepbase binary. `aepbase/go.mod` pins 1.25; an
  older `go` will try to auto-download the 1.25 toolchain (needs network).
- **Node.js 20+** and npm — builds the SPA.
- **Git**.

The resulting binary is self-contained: it embeds the SPA, the sidecar code,
and the aepbase binary (extracting aepbase to a cache dir on first boot), so
nothing but the binary is needed at runtime.

## Common Commands

```bash
make start-services     # Start the service (sudo)
make stop               # Stop the service (sudo)
make restart            # Restart the service (sudo)
make status             # Check status (sudo)
make logs               # Follow logs (sudo)

make deploy             # Build current code + restart the service
make deploy-force       # Force rebuild + restart
make homestead          # Just build the binary (no service interaction)
```

## Deployment

### Manual deployment

```bash
sudo make deploy          # rebuilds if source changed, then restarts
sudo make deploy-force    # always rebuilds
```

`deploy.sh`:
- (in `--auto`) fetches `origin/main` and fast-forwards via `git reset --hard`
- runs `npm ci` when `package*.json` changed
- rebuilds the single binary when any source (`frontend/`, `packages/`,
  `aepbase/`, `scripts/`, `homestead.config.ts`) changed or `--force`
- restarts the `homeos` service and verifies it came up
- rolls back (`git reset --hard` to the previous commit, rebuild, restart)
  if the service fails to start after an auto update

### Schema changes (per-module `resources.ts`)

**Auto-applied on boot.** The Bun sidecar diffs each module's resource
definitions against aepbase and POST/PATCHes them when the service starts.
After deploying a schema change, restart the service:

```bash
sudo systemctl restart homeos
```

If a change drops/renames a resource or mutates a field `type`/`parents`,
delete the affected definition manually first (`DELETE
/aep-resource-definitions/...`) — aepbase preserves data across schema
updates but won't mutate `type`/`parents` in place. See `CLAUDE.md` for the
full set of schema-evolution gotchas.

### Automatic updates

Pulls from GitHub on a timer and redeploys:

```bash
sudo make setup-auto-update
sudo systemctl enable --now homeos-auto-update.timer
sudo systemctl status homeos-auto-update.timer
```

Update frequency lives in `/etc/systemd/system/homeos-auto-update.timer`
(`OnUnitActiveSec=10min` by default). Edit it, then
`sudo systemctl daemon-reload && sudo systemctl restart homeos-auto-update.timer`.

### Rollback

Auto deploys roll back on their own. Manual rollback:

```bash
sudo systemctl stop homeos

# Back up data first if you're concerned:
cp -a aepbase/data aepbase/data.backup.$(date +%Y%m%d_%H%M%S)

git reset --hard HEAD~1
./deployment/build.sh
sudo systemctl start homeos
```

## Tailscale Access (Optional)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
tailscale ip -4
# Reach the app at http://<tailscale-ip>:3000 — the edge server already
# serves the SPA, sidecar, and aepbase proxy on that one port.
```

## Configuration

### Environment (`frontend/.env`)

Both the build (bakes `VAPID_PUBLIC_KEY` into the SPA) and the systemd
service (`EnvironmentFile`, inherited by the sidecar at runtime) read
`frontend/.env`:

```bash
VAPID_PUBLIC_KEY=...      # also baked into the SPA at build time
VAPID_PRIVATE_KEY=...     # keep secret
VAPID_EMAIL=mailto:admin@example.com
GEMINI_API_KEY=...        # optional, receipt OCR
```

The legacy `AEPBASE_URL` / `AEPBASE_ADMIN_*` entries in that file are
ignored — homestead generates and wires aepbase's URL and superuser
credentials internally (see `aepbase/data/credentials.json`).

### Port

The service runs `homestead start --port 3000`. To change it, edit
`ExecStart=` in `/etc/systemd/system/homeos.service` (or the template at
`deployment/systemd/homeos.service` before `make setup-services`), then
`sudo systemctl daemon-reload && sudo systemctl restart homeos`.

### Data directory

The service passes `--data-dir <repo>/aepbase/data`, so the sqlite db
(`aepbase.db`) and uploaded files persist there across deploys.

## Troubleshooting

### Service won't start
```bash
make status
sudo journalctl -u homeos -n 100
```
- `built SPA not found` / `aepbase binary not found` → you're running the
  launcher from source without building. Rebuild the single binary with
  `./deployment/build.sh` (i.e. `make homestead`) and run `bin/homestead`.
- `database already contains users but credentials.json is missing` →
  homestead can't recover the superuser password for an existing DB.
  Restore `aepbase/data/credentials.json` (email + password), or start
  fresh by archiving `aepbase/data`.

### Build fails
- `bun: command not found` → install Bun (see Prerequisites).
- Go toolchain download fails → install Go 1.25+ directly.

### Port already in use
```bash
sudo lsof -i :3000
```

## Backup and Restore

```bash
# Back up (sqlite db + uploaded files + superuser creds)
mkdir -p backups
cp -a aepbase/data backups/aepbase-data.$(date +%Y%m%d_%H%M%S)

# Restore
sudo systemctl stop homeos
rm -rf aepbase/data
cp -a backups/aepbase-data.YYYYMMDD_HHMMSS aepbase/data
sudo systemctl start homeos
```

## Scripts Reference

| Script | Description |
|--------|-------------|
| `build.sh` | Build the single `homestead` binary (`make homestead`) |
| `deploy.sh` | Rebuild + restart the service, with rollback |
| `setup-services.sh` | Install the `homeos` systemd service |
| `setup-auto-update.sh` | Install the auto-update service + timer |

## Production Checklist

- [ ] `frontend/.env` filled in (VAPID keys)
- [ ] `homestead` binary built (`./deployment/build.sh`)
- [ ] `homeos` service installed + enabled
- [ ] Superuser credentials saved (`aepbase/data/credentials.json`)
- [ ] Reachable at http://localhost:3000
- [ ] (Optional) Tailscale configured
- [ ] (Optional) Auto-updates enabled
- [ ] (Optional) Backup strategy configured
