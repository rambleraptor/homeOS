# `@rambleraptor/homestead-app`

The Next.js plumbing for a [Homestead](https://github.com/rambleraptor/homestead)
self-hosted instance: layouts, providers, the module registry, the
catch-all route dispatcher, API route handlers, the server-side aepbase
helper, the schema-sync instrumentation hook, and a `createNextConfig`
factory.

Operators don't import this directly — they run
[`create-homestead-app`](../create-homestead-app/) which generates a
consumer app that depends on this package and re-exports its pages /
handlers from the Next.js App Router.

## Layout

```
packages/homestead-app/
├── registry/              # module registry + types
│   ├── types.ts           # HomeModule, ModuleRoute, etc.
│   ├── config.ts          # HomesteadConfig
│   ├── registry.ts        # imports config via the `@homestead-config` alias
│   ├── router/match.ts    # path → route matching
│   ├── router/gates.tsx   # enabled / superuser gates
│   └── workers/dispatcher.ts
│
├── pages/                 # App Router page components
│   ├── RootLayout.tsx     # + metadata + viewport
│   ├── Providers.tsx      # React Query, Auth, Toast
│   ├── RootRedirect.tsx   # "/" → "/dashboard"
│   ├── NotFound.tsx
│   ├── GlobalError.tsx
│   ├── manifest.ts
│   ├── LoginPage.tsx
│   └── app/               # the "(app)" route segment
│       ├── AppLayout.tsx
│       ├── AppRoot.tsx
│       ├── AppError.tsx
│       ├── CatchAll.tsx   # generateStaticParams + dispatcher
│       └── SearchPage.tsx
│
├── api/                   # API route handlers
│   ├── aepbase-server.ts  # auth + CRUD helpers
│   ├── modulesWorkerRoute.ts
│   ├── omniboxParseRoute.ts
│   ├── notificationsSendTestRoute.ts
│   └── sendUserNotification.ts
│
├── instrumentation/       # exported `register` + `onRequestError`
├── next-config/           # createNextConfig() factory
├── styles/globals.css     # Tailwind v4 @theme + @source
├── tailwind.config.js     # editor hint (Tailwind v4 reads tokens from CSS)
├── postcss.config.cjs     # Tailwind v4 + autoprefixer
├── eslint.config.mjs      # next/core-web-vitals + next/typescript
├── tsconfig.base.json     # consumer apps extend this
└── test/setup.ts          # vitest helpers
```

## The `@homestead-config` alias

`registry/registry.ts` imports the operator's module list via a static
import of `@homestead-config`. The consumer app's `tsconfig.json` aliases
that name to its own `homestead.config.ts`:

```json
{
  "extends": "@rambleraptor/homestead-app/tsconfig.base.json",
  "compilerOptions": {
    "paths": {
      "@homestead-config": ["./homestead.config.ts"]
    }
  }
}
```

When the consumer's `vitest.config.ts` runs tests against this package,
the alias has to be replicated there too (Vitest doesn't read TypeScript
paths automatically). The CLI template wires this up.

The package itself ships a stub at `registry/__config-stub.ts` so it
type-checks standalone (`tsc --noEmit` in the package dir works without
a consumer present).
