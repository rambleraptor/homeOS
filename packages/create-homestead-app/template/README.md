# My Homestead

This is a self-hosted [Homestead](https://github.com/rambleraptor/homestead)
instance scaffolded with `create-homestead-app`.

## Quick start

1. Start aepbase (see the
   [main repo](https://github.com/rambleraptor/homestead#aepbase) for the
   one-time install + `./run.sh`). On first start, aepbase prints the
   superuser email + password — save them.
2. Copy `.env.example` to `.env.local` and fill in `AEPBASE_ADMIN_EMAIL` /
   `AEPBASE_ADMIN_PASSWORD` with those credentials.
3. `npm run dev` and open http://localhost:3000.

## Choosing modules

Edit `homestead.config.ts`. Comment a module out to drop it from the
sidebar; add a new import to bring one in. The settings + superuser
modules are always installed by the framework.

```ts
import { todosModule, giftCardsModule } from '@rambleraptor/homestead-modules';
import type { HomesteadConfig } from '@rambleraptor/homestead-app/registry/config';

const config: HomesteadConfig = {
  modules: [todosModule, giftCardsModule],
};

export default config;
```

## Where things live

Most files in this directory are one-line re-exports that surface the
Next.js plumbing from `@rambleraptor/homestead-app` to the App Router.
The operator-editable files are:

| File | Purpose |
|------|---------|
| `homestead.config.ts` | Choose which modules ship with this instance. |
| `.env.local` | aepbase URL + admin creds, VAPID keys, Gemini key. |
| `app/` | Thin Next.js App Router stubs (re-exports). |
| `public/` | Favicons, PWA icons, service worker. |

For more depth see
[docs/SELF_HOSTING.md](https://github.com/rambleraptor/homestead/blob/main/docs/SELF_HOSTING.md)
in the main repo.
