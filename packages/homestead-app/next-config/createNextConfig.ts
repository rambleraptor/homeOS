import { execSync } from 'child_process';
import type { NextConfig } from 'next';

/**
 * Build a Next.js config preconfigured for a Homestead consumer app.
 *
 * The factory bakes in the bits every Homestead instance needs:
 *   - Transpiles the `@rambleraptor/homestead-{app,core,modules}` workspace
 *     packages (their TypeScript source ships unbuilt).
 *   - Captures git commit info at build time into `NEXT_PUBLIC_COMMIT_*`
 *     so the settings screen can display which revision is running.
 *   - Stubs Node-only builtins for the client/edge target so module
 *     workers that transitively pull `web-push` etc. don't break the
 *     client bundle.
 *   - Rewrites `/api/aep/*` → `${AEPBASE_URL}/*` so the browser hits
 *     same-origin paths (avoids CORS + Cloudflare Access gating issues).
 *
 * Consumers call this from their own `next.config.ts`:
 *
 *     import { createNextConfig } from '@rambleraptor/homestead-app/next-config';
 *     export default createNextConfig();
 *
 * If they need to extend the config they can pass overrides; they merge
 * shallowly over the defaults (with `transpilePackages` concatenated).
 */
export interface CreateNextConfigOptions {
  /**
   * Extra packages to transpile alongside the homestead-* packages.
   * Useful when an operator pulls in another local workspace package
   * that ships TS source.
   */
  extraTranspilePackages?: string[];

  /**
   * Shallowly merged on top of the defaults. Fields that are arrays
   * (e.g. `transpilePackages`) are replaced wholesale — use the
   * dedicated options above to extend them.
   */
  overrides?: Partial<NextConfig>;
}

function readGit(args: string): string {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

export function createNextConfig(
  options: CreateNextConfigOptions = {},
): NextConfig {
  const commitHash = readGit('rev-parse HEAD');
  const commitDate = readGit('log -1 --pretty=format:%cI');
  const commitMessage = readGit('log -1 --pretty=format:%s');

  const config: NextConfig = {
    reactStrictMode: true,
    productionBrowserSourceMaps: true,
    transpilePackages: [
      '@rambleraptor/homestead-app',
      '@rambleraptor/homestead-core',
      '@rambleraptor/homestead-modules',
      ...(options.extraTranspilePackages ?? []),
    ],

    // Hide the Next.js dev-mode indicator (bottom-left overlay). It
    // overlaps the sidebar's logout button at the default Playwright
    // viewport and intercepts pointer events during E2E tests.
    devIndicators: false,

    env: {
      NEXT_PUBLIC_COMMIT_HASH: commitHash,
      NEXT_PUBLIC_COMMIT_DATE: commitDate,
      NEXT_PUBLIC_COMMIT_MESSAGE: commitMessage,
    },

    images: {
      remotePatterns: [],
    },

    // Module workers are declared on `HomeModule` via
    // `load: () => import(...)`, and `module.config.ts` is reachable
    // from client code (providers → registry → modules). That means
    // Webpack creates a client-side chunk for every worker even
    // though the worker is only ever invoked from the catch-all
    // server route. Workers like `groceries/send-grocery-notification`
    // depend on `web-push` (which transitively pulls `agent-base`,
    // `https-proxy-agent`, etc.), and those packages reach for
    // Node-only built-ins. Stub them in the client target so the
    // build doesn't fail; the chunks never run in the browser.
    webpack: (webpackConfig, { nextRuntime }) => {
      if (nextRuntime !== 'nodejs') {
        webpackConfig.resolve = webpackConfig.resolve ?? {};
        webpackConfig.resolve.fallback = {
          ...(webpackConfig.resolve.fallback ?? {}),
          net: false,
          tls: false,
          fs: false,
          dns: false,
          child_process: false,
          http: false,
          https: false,
          http2: false,
          stream: false,
          zlib: false,
          url: false,
          crypto: false,
          os: false,
          path: false,
          querystring: false,
          assert: false,
          buffer: false,
          util: false,
        };
      }
      return webpackConfig;
    },

    // Proxy API requests to aepbase. The browser talks to same-origin
    // paths under `/api/aep/*` and Next.js forwards them. Avoids CORS
    // and Cloudflare Access blocking, and means clients never address
    // aepbase directly. Override the target via `AEPBASE_URL`.
    async rewrites() {
      const aepbaseUrl = process.env.AEPBASE_URL || 'http://127.0.0.1:8090';
      return [
        {
          source: '/api/aep/:path*',
          destination: `${aepbaseUrl}/:path*`,
        },
      ];
    },
  };

  return { ...config, ...(options.overrides ?? {}) };
}
