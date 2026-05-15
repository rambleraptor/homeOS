# Homestead

Homestead is my opinionated app for doing things at home.

It's built on top of [aepbase](https://www.github.com/rambleraptor/aepbase).

## Features
- Grocery list with notifications
- HSA receipt upload
- Credit card perk tracker
- Gift card tracker

> Want to run your own instance with a different mix of modules? See
> **[docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)**.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ and npm
- Go 1.22+ (for building aepbase)

### Self-host (recommended)

If you just want to run Homestead, see
**[docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)**. The short version:

```bash
# 1. Scaffold the consumer app
npx create-homestead-app my-home

# 2. Build + start aepbase (from a fresh clone of this repo)
git clone <your-repo-url>
cd homestead/aepbase
./install.sh && ./run.sh                # serves on :8090

# 3. Wire creds + run the app
cd ../../my-home
cp .env.example .env.local              # fill in AEPBASE_ADMIN_*
npm run dev                             # open http://localhost:3000
```

### Develop on Homestead itself

If you're hacking on Homestead's packages instead of consuming them,
clone and use the in-tree `frontend/` workspace (which is itself a thin
consumer of `@rambleraptor/homestead-app`):

```bash
git clone <your-repo-url>
cd homestead
npm install                             # installs every workspace
cd aepbase && ./install.sh && ./run.sh  # in one terminal
cd ../frontend && npm run dev           # in another
```

## Architecture

### aepbase

All data is stored in [aepbase](https://www.github.com/rambleraptor/aepbase), a local backend that conforms to the [AEP](https://www.aep.dev) API specification.

The frontend is completely optional. You can access your data through the AEP ecosystem of tools, such as a Terraform provider, CLI, [resource explorer UI](https://ui.aep.dev).

### Modular Design

Every feature is a **module** with its own:
- Components (`components/`)
- Hooks (`hooks/`)
- Types (`types.ts`)
- Configuration (`module.config.ts`) — declares the module's
  routes (with their React components), nav placement, dashboard
  widgets, and module flags

**Adding a new module (in this repo):**
1. Create `packages/homestead-modules/<your-module>/` with a
   `module.config.ts` that declares `routes` (each with a `component`)
2. Add the import + array entry to `frontend/homestead.config.ts`
3. Done! No per-route page files, no registry edits — your module
   appears in the navigation automatically and the catch-all router
   serves its routes.

**Adding a module in your own self-hosted instance:** declare a
`HomeModule` inline in your scaffold and add it to your
`homestead.config.ts` — see
[docs/SELF_HOSTING.md](docs/SELF_HOSTING.md#5-add-a-custom-module).

## 🚀 Production Deployment

For deploying Homestead on a local machine (accessible via Tailscale), see:

**[📖 Deployment Guide](deployment/README.md)** - Complete deployment instructions

The deployment package includes systemd service configurations for
aepbase and the Next.js frontend, plus management scripts and sample
production environment files.

## 📝 License

MIT License
