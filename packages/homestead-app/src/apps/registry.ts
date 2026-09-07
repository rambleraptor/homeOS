/**
 * App registry boot shim.
 *
 * The contract types, registry implementation, and helpers all live in
 * `@rambleraptor/homestead-core/apps/registry`. This file's only job
 * is to install the singleton with the full app list — the operator's
 * apps from `homestead.config.ts`, any apps auto-discovered from the
 * project's `<app-dir>/<name>/app.homestead.ts` files, plus the always-installed
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
import discoveredModules from 'virtual:homestead-discovered-apps';

// Resolved at build time by the `homestead:discovered-apps` Vite plugin
// (vite.config.ts / vitest.config.ts), which scans the project's app
// directories — `<project>/apps`, or whatever `HOMESTEAD_APPS_DIRS` names —
// and emits them already in registration order. A project with no app
// directory yields an empty list. The server does the same scan at boot via
// homestead-core/server/app-discovery, off the same helper.
const discoveredApps = discoveredModules.map(([path, mod]) =>
  assertDiscoveredApp(mod, path),
);

initializeAppRegistry(
  withAlwaysInstalled(mergeDiscoveredApps(config.apps ?? [], discoveredApps)),
);

export * from '@rambleraptor/homestead-core/apps/registry';
