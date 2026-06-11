import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const METHOD_STUB_ID = '\0homestead-custom-method-stub';

/**
 * Resource custom-method handlers (ResourceDefinition.customMethods[].load)
 * are server-only — they run in homestead-server, never the browser — but
 * `resources.ts` is reachable from the client registry, so their
 * `() => import('./methods/x')` thunks would otherwise be code-split into
 * dead client chunks (pulling in web-push and friends). Stub those imports in
 * the production build so they never ship. The server bundle is built
 * separately and is unaffected.
 */
function stubCustomMethods(): Plugin {
  const METHOD_RE = /homestead-apps[/\\].*[/\\]methods[/\\][^/\\]+$/;
  return {
    name: 'homestead:stub-custom-methods',
    enforce: 'pre',
    apply: 'build',
    async resolveId(source, importer, options) {
      if (!importer) return null;
      const resolved = await this.resolve(source, importer, {
        ...options,
        skipSelf: true,
      });
      if (resolved && METHOD_RE.test(resolved.id)) return METHOD_STUB_ID;
      return null;
    },
    load(id) {
      if (id === METHOD_STUB_ID) {
        return 'export default function customMethodStub() {\n  throw new Error("custom method handler invoked in the browser bundle");\n}\n';
      }
      return null;
    },
  };
}

/** Read git metadata at build time; tolerate a missing/shallow .git. */
function git(args: string): string {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

const commitHash = git('rev-parse HEAD');
const commitDate = git('log -1 --pretty=format:%cI');
const commitMessage = git('log -1 --pretty=format:%s');

const srcDir = fileURLToPath(new URL('./src', import.meta.url));
// The launcher's build pipeline points HOMESTEAD_CONFIG at the operator's
// project config; the default covers the workspace layout.
const configPath =
  process.env.HOMESTEAD_CONFIG ??
  fileURLToPath(new URL('../../homestead.config.ts', import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [stubCustomMethods(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': srcDir,
      '@homestead/config': configPath,
    },
  },
  // Keep the existing `process.env.*` reads in shared packages working in
  // the browser (and identical under Bun, where process.env is real). The
  // commit metadata is baked in at build time.
  define: {
    'process.env.NODE_ENV': JSON.stringify(
      mode === 'production' ? 'production' : 'development',
    ),
    'process.env.NEXT_PUBLIC_COMMIT_HASH': JSON.stringify(commitHash),
    'process.env.NEXT_PUBLIC_COMMIT_DATE': JSON.stringify(commitDate),
    'process.env.NEXT_PUBLIC_COMMIT_MESSAGE': JSON.stringify(commitMessage),
    'process.env.NEXT_PUBLIC_BUILD_ID': JSON.stringify(commitHash),
    // Set by the launcher's SPA build (spa-build.ts); open tabs compare it
    // against /api/app-version and reload when the served build changes.
    'process.env.HOMESTEAD_BUILD_ID': JSON.stringify(
      process.env.HOMESTEAD_BUILD_ID ?? '',
    ),
    'process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY': JSON.stringify(
      process.env.VAPID_PUBLIC_KEY ??
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
        '',
    ),
  },
  // No dev `server` block: in dev, Vite runs in middleware mode inside
  // homestead-server (see packages/homestead-server/src/dev-vite.ts), which
  // serves /api/* and /oauth/* itself — no proxy needed.
  build: {
    // Built SPA. The launcher overrides --outDir into its build cache
    // (spa-build.ts); `make build` uses this default. Sourcemaps stay off in
    // prod builds — flip on locally if you need to debug one.
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
}));
