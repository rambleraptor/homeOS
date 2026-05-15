# `create-homestead-app`

Scaffold a new self-hosted [Homestead](https://github.com/rambleraptor/homestead)
instance.

## Usage

```bash
npx create-homestead-app my-home
cd my-home
# edit .env.local with your aepbase superuser credentials
npm run dev
```

That produces:

```
my-home/
├── package.json            # depends on @rambleraptor/homestead-{app,core,modules}
├── tsconfig.json           # extends @rambleraptor/homestead-app/tsconfig.base.json
├── next.config.ts          # calls createNextConfig() from the package
├── postcss.config.js       # re-exports from the package
├── eslint.config.mjs       # re-exports from the package
├── instrumentation.ts      # re-exports register + onRequestError
├── homestead.config.ts     # ← edit this to choose your modules
├── .env.example            # AEPBASE_*, VAPID_*, GEMINI_API_KEY
├── public/                 # PWA icons + service worker
└── app/                    # thin Next.js App Router re-export shell
```

Every file in `app/` is a one-line re-export from
`@rambleraptor/homestead-app`. The Next.js plumbing lives in the
package; the only file you actually edit to configure your instance is
`homestead.config.ts`.

See the [self-hosting guide](https://github.com/rambleraptor/homestead/blob/main/docs/SELF_HOSTING.md)
for the full walk-through (running aepbase, env vars, adding a custom
module).
