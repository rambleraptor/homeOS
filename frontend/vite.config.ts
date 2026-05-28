import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
const configPath = fileURLToPath(
  new URL('../homestead.config.ts', import.meta.url),
);

const AEPBASE_URL = process.env.AEPBASE_URL || 'http://127.0.0.1:8090';
const SIDECAR_URL = process.env.SIDECAR_URL || 'http://127.0.0.1:4000';
// When the Go edge fronts Vite on a different port, HMR's websocket must
// connect back through the edge, not Vite's own port.
const HMR_CLIENT_PORT = process.env.VITE_HMR_CLIENT_PORT
  ? Number(process.env.VITE_HMR_CLIENT_PORT)
  : undefined;

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
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
    'process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY': JSON.stringify(
      process.env.VAPID_PUBLIC_KEY ??
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
        '',
    ),
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: HMR_CLIENT_PORT ? { clientPort: HMR_CLIENT_PORT } : undefined,
    proxy: {
      // aepbase: strip the `/api/aep` prefix and forward (matches the old
      // Next rewrite). Everything else under /api goes to the sidecar.
      '/api/aep': {
        target: AEPBASE_URL,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/aep/, ''),
      },
      '/api/omnibox': { target: SIDECAR_URL, changeOrigin: true },
      '/api/notifications': { target: SIDECAR_URL, changeOrigin: true },
      '/api/modules': { target: SIDECAR_URL, changeOrigin: true },
    },
  },
  build: {
    outDir: '../homestead/internal/edge/dist',
    emptyOutDir: true,
    sourcemap: true,
  },
}));
