/**
 * App registry boot shim.
 *
 * The contract types, registry implementation, and helpers all live in
 * `@rambleraptor/homestead-core/apps/registry`. This file's only job
 * is to install the singleton with the full app list — the operator's
 * apps from `homestead.config.ts`, any apps auto-discovered from the
 * project's `apps/<dir>/app.homestead.ts` files, plus the always-installed
 * core apps (settings, users, superuser, chat) that the rest of the app
 * depends on. Importing this app triggers the side effect, and the
 * re-export keeps existing `@/apps/registry` call sites working.
 */

import { initializeAppRegistry } from '@rambleraptor/homestead-core/apps/registry';
import { withAlwaysInstalled } from '@rambleraptor/homestead-core/apps/core-apps';
import {
  assertDiscoveredApp,
  mergeDiscoveredApps,
} from '@rambleraptor/homestead-core/apps/discovery';
import config from '@homestead/config';

// Resolved at build time; `@homestead-project` aliases the operator's project
// root (vite.config.ts / vitest.config.ts). A project without an apps/ dir
// globs to zero modules. The server does the same scan at boot via
// homestead-core/server/app-discovery.
const discoveredModules = import.meta.glob(
  '@homestead-project/apps/*/app.homestead.ts',
  { eager: true },
);
const discoveredApps = Object.keys(discoveredModules)
  .sort()
  .map((path) => assertDiscoveredApp(discoveredModules[path], path));

initializeAppRegistry(
  withAlwaysInstalled(mergeDiscoveredApps(config.apps ?? [], discoveredApps)),
);

export * from '@rambleraptor/homestead-core/apps/registry';
