/**
 * App registry boot shim.
 *
 * The contract types, registry implementation, and helpers all live in
 * `@rambleraptor/homestead-core/apps/registry`. This file's only job
 * is to install the singleton with the full app list — the operator's
 * apps from `homestead.config.ts` plus the always-installed core
 * apps (settings, users, superuser, chat) that the rest of the app
 * depends on. Importing this app triggers the side effect, and the
 * re-export keeps existing `@/apps/registry` call sites working.
 */

import { initializeAppRegistry } from '@rambleraptor/homestead-core/apps/registry';
import { withAlwaysInstalled } from '@rambleraptor/homestead-core/apps/core-apps';
import config from '@homestead/config';

initializeAppRegistry(withAlwaysInstalled(config.apps));

export * from '@rambleraptor/homestead-core/apps/registry';
