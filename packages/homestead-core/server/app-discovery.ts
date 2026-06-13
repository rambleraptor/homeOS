/**
 * Server-side app auto-discovery: scan a project's `apps/` directory
 * for `apps/<dir>/app.homestead.ts` files and import each one. The SPA
 * does the equivalent at build time via `import.meta.glob` in its boot
 * shim (packages/homestead-app/src/apps/registry.ts); both sides share
 * the validation + merge helpers in `../apps/discovery`.
 *
 * Server-only (node:fs / node:url) — never import from browser code.
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AppConfig } from '../apps/types';
import { assertDiscoveredApp } from '../apps/discovery';

/** Per-app config filename discovery looks for inside each apps/ subdir. */
export const DISCOVERED_APP_FILENAME = 'app.homestead.ts';

/**
 * The project's apps directory: `HOMESTEAD_APPS_DIR` when the launcher
 * (or a test) sets it, else `<cwd>/apps` — the server always runs with
 * cwd = project root.
 */
export function defaultAppsDir(): string {
  return process.env.HOMESTEAD_APPS_DIR ?? join(process.cwd(), 'apps');
}

/**
 * Import every `<appsDir>/<dir>/app.homestead.ts`, sorted by directory
 * name for deterministic registration order. A missing apps dir, or a
 * subdir without the file, yields nothing. A file that fails to import
 * or doesn't default-export an AppConfig throws — boot should fail
 * loudly rather than silently drop an app.
 */
export async function discoverApps(appsDir: string): Promise<AppConfig[]> {
  if (!existsSync(appsDir)) return [];
  const dirs = readdirSync(appsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() || e.isSymbolicLink())
    .map((e) => e.name)
    .sort();
  const apps: AppConfig[] = [];
  for (const name of dirs) {
    const file = join(appsDir, name, DISCOVERED_APP_FILENAME);
    if (!existsSync(file)) continue;
    const mod: unknown = await import(pathToFileURL(file).href);
    apps.push(assertDiscoveredApp(mod, file));
  }
  return apps;
}
