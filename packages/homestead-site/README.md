# Homestead marketing site

The public marketing/docs site, built with [VitePress](https://vitepress.dev).
Source lives in `docs/`; the static build lands in `docs/.vitepress/dist`.

## Local development

```bash
npm run dev      # vitepress dev server
npm run build    # static build → docs/.vitepress/dist
npm run preview  # serve the built site locally
```

## Hosting: Cloudflare Pages (Git integration)

The site is published on Cloudflare Pages via **Git integration** — Cloudflare
builds and deploys automatically on every push to `main`, with preview
deployments for other branches/PRs. Build settings are committed in
[`wrangler.jsonc`](./wrangler.jsonc); the only manual step is connecting the
repo once.

### One-time setup

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**, and select the `rambleraptor/homestead` repo.
2. Configure the build (a monorepo, so set the root directory to this package):

   | Setting                  | Value                       |
   | ------------------------ | --------------------------- |
   | Project name             | `homestead-site`            |
   | Production branch        | `main`                      |
   | Root directory           | `packages/homestead-site`   |
   | Framework preset         | `VitePress`                 |
   | Build command            | `npm run build`             |
   | Build output directory   | `docs/.vitepress/dist`      |

   Because the root directory is this package, Cloudflare installs only this
   package's deps (`vitepress` + `typescript`) — the rest of the monorepo is
   not pulled into the build. The output directory is also read from
   `wrangler.jsonc`, so it stays in sync if it ever changes.
3. **Save and Deploy.** Subsequent pushes deploy automatically.
4. (Optional) Add a custom domain under the project's **Custom domains** tab.

### Manual / fallback deploy

For a one-off deploy outside Git integration (requires `wrangler login` or a
`CLOUDFLARE_API_TOKEN`):

```bash
npm run cf:deploy   # builds, then `wrangler pages deploy`
npm run cf:preview  # serve the built output through the Pages runtime locally
```
