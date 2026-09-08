/**
 * `virtual:homestead-discovered-apps` — the SPA half of app auto-discovery.
 *
 * The boot shim (`src/apps/registry.ts`) needs every
 * `<app-dir>/<name>/app.homestead.ts` in the operator's project. It used to
 * reach them with a single `import.meta.glob`, but the set of directories is
 * now configurable (`HOMESTEAD_APPS_DIRS`) and `import.meta.glob` only takes
 * literal patterns, so this plugin generates the module instead: one static
 * import per discovered file, in the same order the server registers them.
 *
 * `homestead-core/server/app-discovery` is the canonical description of that
 * env var and scan; the lookup is re-implemented here rather than imported
 * because Vite externalizes workspace packages while loading a config file,
 * which would leave Node to import core's TypeScript directly. The two stay
 * in step by test (`src/apps/__tests__/discovered-apps.test.ts`).
 */

import { existsSync, readdirSync } from 'node:fs';
import { delimiter, join, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

/** Module specifier the boot shim imports. */
export const DISCOVERED_APPS_MODULE = 'virtual:homestead-discovered-apps';

const RESOLVED_ID = `\0${DISCOVERED_APPS_MODULE}`;
const APP_CONFIG_FILENAME = 'app.homestead.ts';

/**
 * The app directories a build rooted at `projectRoot` scans: every
 * `HOMESTEAD_APPS_DIRS` entry when it names any, else `HOMESTEAD_APPS_DIR`,
 * else `<projectRoot>/apps`. Relative entries resolve against the operator's
 * project, not the cwd Vite happens to run in (the SPA shell package, in
 * prod builds).
 */
export function projectAppsDirs(
  projectRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const listed = (env.HOMESTEAD_APPS_DIRS ?? '')
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => resolve(projectRoot, entry));
  if (listed.length > 0) return [...new Set(listed)];
  const single = env.HOMESTEAD_APPS_DIR?.trim();
  return [single ? resolve(projectRoot, single) : join(projectRoot, 'apps')];
}

/**
 * Every `<dir>/<name>/app.homestead.ts` under `dirs`, in the order the
 * directories were given and sorted by subdirectory name within each. A
 * missing directory, or a subdirectory without the file, yields nothing.
 */
export function appConfigFiles(dirs: string[]): string[] {
  const files: string[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const names = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() || e.isSymbolicLink())
      .map((e) => e.name)
      .sort();
    for (const name of names) {
      const file = join(dir, name, APP_CONFIG_FILENAME);
      if (existsSync(file)) files.push(file);
    }
  }
  return files;
}

/** Generate `virtual:homestead-discovered-apps` for `dirs`. */
export function renderDiscoveredAppsModule(dirs: string[]): string {
  const files = appConfigFiles(dirs);
  const imports = files
    .map((file, i) => `import * as app${i} from ${JSON.stringify(file)};`)
    .join('\n');
  const entries = files
    .map((file, i) => `  [${JSON.stringify(file)}, app${i}],`)
    .join('\n');
  return `${imports}\n\nexport default [\n${entries}\n];\n`;
}

export function discoveredApps(projectRoot: string): Plugin {
  const dirs = projectAppsDirs(projectRoot);
  return {
    name: 'homestead:discovered-apps',
    resolveId(id) {
      return id === DISCOVERED_APPS_MODULE ? RESOLVED_ID : null;
    },
    load(id) {
      return id === RESOLVED_ID ? renderDiscoveredAppsModule(dirs) : null;
    },
    configureServer(server) {
      // The app dirs live outside the Vite root (this package), so the dev
      // watcher doesn't cover them — a newly added app.homestead.ts would
      // never invalidate this module. Watch them explicitly and re-generate.
      for (const dir of dirs) server.watcher.add(dir);
      const regenerate = (path: string): void => {
        if (!dirs.some((dir) => path.startsWith(dir + sep))) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) void server.reloadModule(mod);
      };
      for (const event of ['add', 'unlink', 'addDir', 'unlinkDir'] as const) {
        server.watcher.on(event, regenerate);
      }
    },
  };
}
