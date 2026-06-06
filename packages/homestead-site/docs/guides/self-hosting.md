# Self-hosting Homestead

This guide walks you from a fresh clone to a running instance configured
with the modules you want. If you're a contributor working on Homestead
itself, the root [`README.md`](https://github.com/rambleraptor/homestead/blob/main/README.md) covers the same backend
bootstrap with less hand-holding around module choice.

## What you're building

Two processes:

- **aepbase** — a small Go binary that serves an AEP-compliant REST API
  backed by SQLite. Holds all your data.
- **frontend** — a Vite + React SPA that talks to aepbase over a same-origin
  `/api/aep` proxy.

Each user-facing feature (gift cards, recipes, todos, …) is an opt-in
**module**. You pick which ones to ship by editing one file:
[`homestead.config.ts`](https://github.com/rambleraptor/homestead/blob/main/homestead.config.ts).

## Prerequisites

- Node.js 20+ and npm
- Go 1.22+ (for building aepbase)
- Terraform 1.6+ (for applying the schema once)

## 1. Clone and install

```bash
git clone <your-fork-url>
cd homestead
npm install            # installs every workspace package
```

## 2. Choose your modules

Open `homestead.config.ts`. It looks like this:

```ts
import {
  creditCardsModule, dashboardModule, gamesModule, giftCardsModule,
  groceriesModule, hsaModule, notificationsModule, peopleModule,
  recipesModule, todosModule,
} from '@rambleraptor/homestead-modules';
import type { HomesteadConfig } from '@rambleraptor/homestead-core/modules/config';

const config: HomesteadConfig = {
  modules: [
    dashboardModule, todosModule, giftCardsModule, groceriesModule,
    recipesModule, peopleModule, hsaModule, creditCardsModule,
    gamesModule, notificationsModule,
  ],
};

export default config;
```

To trim the instance down — say, you only want a todo list and groceries:

```ts
const config: HomesteadConfig = {
  modules: [
    dashboardModule,
    todosModule,
    groceriesModule,
  ],
};
```

The settings and superuser modules are always installed by the registry
and don't appear in this list. They cover account management and flag
management — surfaces the rest of the app depends on.

Removing a module hides it from the sidebar, makes its URLs 404, and
drops its dashboard widget. The collections it owned are no longer
applied on the next sidecar boot — old data still lives in aepbase
(deleting a resource definition is destructive and isn't done
automatically), but new writes will 404.

## 3. Bootstrap the backend

```bash
cd aepbase
./install.sh           # first time only — builds bin/aepbase
./run.sh               # serves on :8090
```

aepbase writes the superuser email + password to `data/credentials.json`
on first start. Set them as `AEPBASE_ADMIN_EMAIL` and
`AEPBASE_ADMIN_PASSWORD` in the **sidecar's** environment so its boot-time
schema sync runs automatically. The schema is applied once at sidecar
boot — no separate `apply` step is needed. (The `homestead` launcher does
this wiring for you; these manual steps are only for running the pieces
standalone.)

## 4. Run the frontend

In a third terminal:

```bash
cd frontend
npm run dev
```

Open http://localhost:3000 and log in with the superuser credentials
from step 3. `/` redirects to the dashboard; the sidebar shows whichever
modules you kept in `homestead.config.ts`.

## Optional: OAuth login

You can let people sign in with Google (or any OAuth2/OIDC provider)
instead of a password. aepbase runs the authorization-code exchange,
reads the provider's userinfo, and mints the same bearer token password
login uses, so nothing else in the stack changes.

By default login is **existing-users-only**: the email returned by the
provider must match a user you already created via `POST /users`. Unknown
emails are rejected. Set `"allow_registration": true` on a provider to let
first-time sign-ins create a new account instead.

Configure OAuth in **`homestead.config.ts`** under `auth.oauth`. The launcher
reads it natively and passes it to aepbase; secrets are pulled from the
environment so they never live in source or the client bundle. The shipped
config enables a Google provider when `GOOGLE_OAUTH_CLIENT_ID` +
`GOOGLE_OAUTH_CLIENT_SECRET` are set — edit the `providers` array to add others
(aepbase does no OIDC discovery, so the authorize/token/userinfo URLs are
explicit):

```ts
// homestead.config.ts (excerpt)
auth: {
  oauth: {
    // App origin + /api/aep. Each provider's redirect_uri is
    //   {redirectBaseUrl}/oauth/{name}/callback
    // Register that exact URL in the provider console (e.g. Google Cloud).
    redirectBaseUrl: 'http://localhost:3000/api/aep',
    // SPA route the callback returns to (token in the URL fragment).
    successRedirect: 'http://localhost:3000/auth/callback',
    providers: [
      {
        name: 'google',
        displayName: 'Google',
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
        scopes: ['openid', 'email', 'profile'],
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
        // allowRegistration: true,  // let first-time sign-ins create accounts
      },
    ],
  },
},
```

```bash
# Set these in the launcher's environment (e.g. systemd EnvironmentFile):
GOOGLE_OAUTH_CLIENT_ID=…
GOOGLE_OAUTH_CLIENT_SECRET=…
```

With at least one provider configured, the login page shows a "Sign in with …"
button per provider. Leaving `auth.oauth` off (or its `providers` empty) keeps
OAuth disabled entirely.

## 5. Add a custom module

A module is self-describing. The minimum is a `module.config.ts` and
the components its routes render:

```
packages/homestead-modules/laundry/
├── components/
│   └── LaundryHome.tsx
├── module.config.ts
└── index.ts
```

```ts
// module.config.ts
import { Shirt } from 'lucide-react';
import type { HomeModule } from '@rambleraptor/homestead-core/modules/types';
import { LaundryHome } from './components/LaundryHome';

export const laundryModule: HomeModule = {
  id: 'laundry',
  name: 'Laundry',
  description: 'Track loads and detergent inventory.',
  icon: Shirt,
  basePath: '/laundry',
  routes: [{ path: '', index: true, component: LaundryHome }],
  section: 'Home',
};
```

Then in `homestead.config.ts`:

```ts
import { laundryModule } from '@rambleraptor/homestead-modules/laundry';

const config: HomesteadConfig = {
  modules: [
    /* existing modules... */
    laundryModule,
  ],
};
```

If your module needs its own aepbase collection, add a `resources.ts`
next to `module.config.ts` exporting a `ResourceDefinition[]`, and
reference it from the module's config (`resources: [...]`). The sidecar's
boot-time schema sync applies it; restart the stack to pick up the
change. The `create-module` skill scaffolds a new module end-to-end —
resource definitions, hooks, components, config wiring, and e2e
fixtures.

## 6. Production deployment

For a long-lived instance, Homestead ships as a **single binary**:
`homestead start` spawns aepbase as a child process, serves the Bun sidecar
in-process, and serves the embedded SPA behind one port.

### systemd + auto-update (the binary way)

On the host that holds your `homestead.config.ts` (a git checkout of your
config repo), install the services with the CLI:

```bash
sudo homestead install-service --update-interval=5m
sudo systemctl start homestead
```

This generates and enables three units (idempotent — re-run any time, e.g. to
change `--update-interval`):

- `homestead.service` — runs `homestead start`.
- `homestead-update.service` / `.timer` — runs `homestead update` on a cadence
  (default every 5 minutes).

`homestead update` fetches the upstream of your config repo (the `git` block in
`homestead.config.ts`, default `origin/main`) and, when the checkout is behind,
fast-forwards to it and restarts `homestead.service`. So you can **edit your
config from a phone** — push to the upstream and the server picks it up on the
next tick. A failed restart (e.g. a bad config) rolls back to the previous
commit automatically. Run it by hand any time with `homestead update`.

### Building from source

If you deploy from a full source checkout instead, `./deployment/build.sh`
compiles the binary. See
[`deployment/README.md`](https://github.com/rambleraptor/homestead/blob/main/deployment/README.md)
for that walkthrough (env setup via `packages/homestead-app/.env`, Tailscale,
backups). The `deployment/*.sh` setup scripts are superseded by
`homestead install-service` / `homestead update`.

## Where things live

```
homeOS/
├── homestead.config.ts             # ← the file you edit (modules + auth)
├── frontend/                       # Vite + React SPA
│   └── src/                        # entry, App router, module route shim
├── packages/
│   ├── homestead-cli/              # the `homestead` launcher (Bun TS)
│   ├── homestead-modules/          # opt-in feature modules
│   ├── homestead-core/             # shared types, clients, core modules
│   └── homestead-sidecar/          # Bun + Hono API routes + schema sync
├── aepbase/                        # Go aepbase host binary (main.go + oauth.go …)
└── deployment/                     # systemd unit files + scripts
```
