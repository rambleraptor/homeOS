/**
 * Server configuration. Everything the server needs is passed here directly —
 * there is no env-var serialization between processes (the standalone entry
 * derives options from argv; the launcher spawns it as a `bun` child).
 * Operator config (apps, auth.oauth) is read straight from
 * homestead.config.ts via src/app-registry.js.
 */

import type { SpaAssets } from './static';

export interface ServerOptions {
  /** Dev mode: serve the SPA through Vite middleware with HMR. */
  dev: boolean;
  /** The only port: SPA + /api/* (incl. the /api/aep engine gateway). */
  publicPort: number;
  /** Absolute data dir for the sqlite db + uploaded files. */
  dataDir: string;
  /** Static SPA assets for prod (defaults to packages/homestead-app/dist). */
  spa?: SpaAssets;
  /**
   * Identifier of the SPA build being served, exposed at /api/app-version.
   * The launcher passes the build hash; open tabs poll the endpoint and
   * reload when it changes. Empty/absent (dev, bare source runs) disables
   * the client-side reload check.
   */
  buildId?: string;
  /** App-access cache TTL; defaults to AEPBASE_ACCESS_CACHE_TTL_MS or 5000. */
  accessCacheTtlMs?: number;
}

export const DEFAULT_PUBLIC_PORT = 3000;

/** Path prefixes owned by the server, never by the SPA/Vite. */
const SERVER_PREFIXES = ['/api/', '/oauth/', '/health'];

export function isServerPath(path: string): boolean {
  return SERVER_PREFIXES.some((p) => path === p || path === p.replace(/\/$/, '') || path.startsWith(p));
}
