# `frontend/`

The in-tree consumer of `@rambleraptor/homestead-app`. This directory
mirrors what `create-homestead-app` generates for a self-hosted instance
— same `app/` re-exports, same one-line config files, same
`homestead.config.ts`. We use it to dogfood the package and to run the
e2e tests inside this repo.

Operator-facing files:

| File | Purpose |
|------|---------|
| `homestead.config.ts` | Which modules ship in this instance. |
| `app/` | One-line re-exports from `@rambleraptor/homestead-app`. Touch only when adding a custom route on top of the shell. |
| `instrumentation.ts` | Re-exports `register` + `onRequestError`. |
| `next.config.ts` | Calls `createNextConfig()` from the package. |
| `tsconfig.json` | Extends `@rambleraptor/homestead-app/tsconfig.base.json`; sets the `@homestead-config` alias. |
| `postcss.config.js` / `eslint.config.mjs` | Re-export the package mirrors. |
| `public/` | PWA icons + service worker. |
| `.env.example` | AEPBASE_*, VAPID_*, GEMINI_API_KEY. |

## Development

```bash
# from repo root
npm install
make dev              # cd frontend && npm run dev
```

For the full repo gate before pushing:

```bash
make ci && make test
```

## What lives where

Most code lives in the workspace packages, not here:

- **`packages/homestead-app/`** — Next.js shell: layouts, providers,
  registry, catch-all router, API route handlers, instrumentation hook,
  `createNextConfig`.
- **`packages/homestead-core/`** — auth, shared UI, aepbase client,
  resource sync, settings + superuser modules.
- **`packages/homestead-modules/`** — opt-in feature modules.

See [`docs/SELF_HOSTING.md`](../docs/SELF_HOSTING.md) for the
operator-facing walk-through.
