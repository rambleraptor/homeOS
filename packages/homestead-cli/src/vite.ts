import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './paths.ts';
import { spawnChild, type Child } from './proc.ts';

export interface ViteOptions {
  /** User-facing port; Vite serves here directly and proxies /api itself. */
  port: number;
  aepbaseUrl: string;
  sidecarUrl: string;
}

/**
 * Start the Vite dev server (HMR) for `homestead start --dev`. Vite listens on
 * the user-facing port and proxies `/api/*` to aepbase / the sidecar via its
 * own config (seeded by AEPBASE_URL / SIDECAR_URL), so no edge proxy is needed
 * in dev.
 */
export function startVite(opts: ViteOptions): Child {
  return spawnChild({
    cmd: [
      viteBin(),
      '--port',
      String(opts.port),
      '--strictPort',
      '--host',
      '127.0.0.1',
    ],
    cwd: join(repoRoot, 'packages', 'homestead-app'),
    env: {
      AEPBASE_URL: opts.aepbaseUrl,
      SIDECAR_URL: opts.sidecarUrl,
      VITE_HMR_CLIENT_PORT: String(opts.port),
    },
    tag: '[vite]',
  });
}

function viteBin(): string {
  const candidates = [
    join(repoRoot, 'packages', 'homestead-app', 'node_modules', '.bin', 'vite'),
    join(repoRoot, 'node_modules', '.bin', 'vite'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error('vite not found — run `npm install` (Node 20+ required for --dev)');
}
