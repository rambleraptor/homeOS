# Homestead marketing site

The public marketing/docs site, built with [VitePress](https://vitepress.dev).
Source lives in `docs/`; the static build lands in `docs/.vitepress/dist`.

## Local development

```bash
npm run dev      # vitepress dev server
npm run build    # static build → docs/.vitepress/dist
npm run preview  # serve the built site locally
```

## Hosting: Cloudflare Workers Static Assets (Git integration)

The site is published on Cloudflare as an **assets-only Worker** (Workers Static
Assets) via **Workers Builds** Git integration — Cloudflare builds and deploys
automatically on every push to `main`, with preview deployments for other
branches/PRs. There is no server code: `wrangler.jsonc` points
`assets.directory` at the VitePress build and Cloudflare serves it directly.

> Why a Worker and not Pages? Cloudflare now recommends Workers Static Assets
> over Pages for new static sites, and the `homestead` Worker is already wired
> to the repo. Functionally it's the same static hosting.

### Build settings (in the dashboard)

The `homestead` Worker → **Settings** → **Build** is configured as:

| Setting          | Value                          |
| ---------------- | ------------------------------ |
| Production branch | `main`                        |
| Root directory   | `packages/homestead-site`      |
| Build command    | `npm run build`                |
| Deploy command   | `npx wrangler versions upload` |

Because the root directory is this package, Cloudflare installs only this
package's deps (`vitepress` + `typescript`) — the rest of the monorepo is not
pulled into the build. The deploy command reads [`wrangler.jsonc`](./wrangler.jsonc),
so the Worker name and assets directory stay in sync from the repo.

A custom domain can be added under the Worker's **Domains & Routes** tab.

### Manual / fallback deploy

For a one-off deploy outside Git integration (requires `wrangler login` or a
`CLOUDFLARE_API_TOKEN`):

```bash
npm run cf:deploy   # builds, then `wrangler deploy`
npm run cf:preview  # serve the built output through the Workers runtime locally
```
