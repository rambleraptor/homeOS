/**
 * Server-side app auto-discovery: scan the project's app directories for
 * `<app-dir>/<name>/app.homestead.ts` files and import each one. The SPA
 * does the equivalent at build time via the `virtual:homestead-discovered-apps`
 * module its Vite plugin generates from {@link discoveredAppFiles}; both sides
 * share the validation + merge helpers in `../apps/discovery`.
 *
 * Server-only (node:fs / node:url) — never import from browser code.
 */

import { existsSync, readdirSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AppConfig } from '../apps/types';
import { assertDiscoveredApp } from '../apps/discovery';

/** Per-app config filename discovery looks for inside each app dir's subdirs. */
export const DISCOVERED_APP_FILENAME = 'app.homestead.ts';

/**
 * Optional env var naming *every* directory discovery scans, separated by the
 * platform path delimiter (`:` on macOS/Linux) — e.g.
 * `HOMESTEAD_APPS_DIRS=apps:/srv/shared-apps`. When set it replaces the
 * single-directory lookup entirely, so include `apps` explicitly to keep it.
 */
export const APPS_DIRS_ENV = 'HOMESTEAD_APPS_DIRS';

/** Single-directory override, used only when {@link APPS_DIRS_ENV} is unset. */
export const APPS_DIR_ENV = 'HOMESTEAD_APPS_DIR';

/**
 * Split a {@link APPS_DIRS_ENV} value into absolute directories: blank entries
 * are dropped, relative entries resolve against `base`, and a directory named
 * twice is kept once (discovery order follows first mention).
 */
export function parseAppsDirs(
  raw: string | undefined,
  base: string = process.cwd(),
): string[] {
  const seen = new Set<string>();
  const dirs: string[] = [];
  for (const entry of (raw ?? '').split(delimiter)) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const abs = resolve(base, trimmed);
    if (seen.has(abs)) continue;
    seen.add(abs);
    dirs.push(abs);
  }
  return dirs;
}

/**
 * The directories app discovery scans, in precedence order:
 * {@link APPS_DIRS_ENV} when it names at least one directory, else the single
 * {@link APPS_DIR_ENV} the launcher sets, else `<base>/apps`. `base` is the
 * project root — the server always runs with cwd there.
 */
export function appsDirs(
  env: Record<string, string | undefined> = process.env,
  base: string = process.cwd(),
): string[] {
  const list = parseAppsDirs(env[APPS_DIRS_ENV], base);
  if (list.length > 0) return list;
  const single = env[APPS_DIR_ENV]?.trim();
  return [single ? resolve(base, single) : join(base, 'apps')];
}

/**
 * Every `<dir>/<name>/app.homestead.ts` under `dirs`, in the order the
 * directories were given and sorted by subdirectory name within each — the
 * registration order both the server and the SPA use. A missing directory, or
 * a subdirectory without the file, yields nothing.
 */
export function discoveredAppFiles(dirs: string[]): string[] {
  const files: string[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const names = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() || e.isSymbolicLink())
      .map((e) => e.name)
      .sort();
    for (const name of names) {
      const file = join(dir, name, DISCOVERED_APP_FILENAME);
      if (existsSync(file)) files.push(file);
    }
  }
  return files;
}

/**
 * Import every discovered `app.homestead.ts` under `dirs`. A file that fails
 * to import or doesn't default-export an AppConfig throws — boot should fail
 * loudly rather than silently drop an app. Two directories claiming the same
 * app id are reconciled later, by `mergeDiscoveredApps`.
 */
export async function discoverApps(dirs: string[]): Promise<AppConfig[]> {
  const apps: AppConfig[] = [];
  for (const file of discoveredAppFiles(dirs)) {
    let mod: unknown;
    try {
      mod = await import(pathToFileURL(file).href);
    } catch (err) {
      throw new Error(describeImportFailure(file, err), { cause: err });
    }
    apps.push(assertDiscoveredApp(mod, file));
  }
  return apps;
}

/**
 * An app's own imports resolve from where the app file lives, so a directory
 * outside the project can't see the project's `node_modules` — the bare
 * message ("Cannot find package '@rambleraptor/homestead-core'") doesn't say
 * that. Name the app file and the likely fix; anything else passes through.
 */
function describeImportFailure(file: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string } | null)?.code;
  if (code !== 'ERR_MODULE_NOT_FOUND' && code !== 'MODULE_NOT_FOUND') {
    return `${file} failed to import: ${message}`;
  }
  return (
    `${file} failed to import: ${message}\n` +
    `An app's dependencies resolve from the directory the app lives in, so an ` +
    `app directory outside the project must be its own npm project with the ` +
    `homestead packages installed. Move it under the project, or install its ` +
    `dependencies there.`
  );
}
