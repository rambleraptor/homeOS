import { execSync } from 'child_process';
import path from 'path';
import type { NextConfig } from 'next';

// Capture git commit info at build time so the settings screen can display
// which revision of Homestead is running. Falls back to 'unknown' if git is
// unavailable (e.g. a shallow Docker build without the .git directory).
function readGit(args: string): string {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

const commitHash = readGit('rev-parse HEAD');
const commitDate = readGit('log -1 --pretty=format:%cI');
const commitMessage = readGit('log -1 --pretty=format:%s');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: true,
  transpilePackages: [
    '@rambleraptor/homestead-core',
    '@rambleraptor/homestead-modules',
  ],

  // Hide the Next.js dev-mode indicator (bottom-left overlay). It overlaps
  // the sidebar's logout button at the default Playwright viewport and
  // intercepts pointer events during E2E tests. The indicator adds no value
  // to our normal dev workflow either.
  devIndicators: false,

  env: {
    NEXT_PUBLIC_COMMIT_HASH: commitHash,
    NEXT_PUBLIC_COMMIT_DATE: commitDate,
    NEXT_PUBLIC_COMMIT_MESSAGE: commitMessage,
  },

  images: {
    remotePatterns: [],
  },

  // Module workers are declared on `HomeModule` via `load: () => import(...)`,
  // and `module.config.ts` is reachable from client code (providers →
  // registry → modules). That means Webpack creates a client-side chunk
  // for every worker even though the worker is only ever invoked from the
  // catch-all server route. Workers like `groceries/send-grocery-notification`
  // depend on `web-push` (which transitively pulls `agent-base`,
  // `https-proxy-agent`, etc.), and those packages reach for Node-only
  // built-ins. Stub them in the client target so the build doesn't fail;
  // the chunks never run in the browser.
  webpack: (config, { nextRuntime }) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@homestead/config': path.resolve(__dirname, '../homestead.config.ts'),
    };
    // Apply for the client (`nextRuntime === undefined`) and the edge
    // runtime — both lack Node built-ins. The Node server resolves them
    // natively, so we leave that target alone.
    if (nextRuntime !== 'nodejs') {
      config.resolve = config.resolve ?? {};
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
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
    return config;
  },

  // Proxy API requests to aepbase. The browser talks to same-origin paths
  // under `/api/aep/*` and Next.js forwards them. Avoids CORS and
  // Cloudflare Access blocking, and means clients never address aepbase
  // directly. Override the target via the `AEPBASE_URL` env var.
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

export default nextConfig;
